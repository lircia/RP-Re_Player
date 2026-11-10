import { spawn } from "node:child_process";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const localEnvFiles = [".dev.vars", ".env"].filter((file) => existsSync(path.resolve(file)));
const fileConfiguredVariables = new Set();
for (const file of localEnvFiles) {
  const envFile = path.resolve(file);
  for (const match of readFileSync(envFile, "utf8").matchAll(/^\s*(?:export\s+)?(VP|AP|VPS|APS)\s*=/gm)) {
    fileConfiguredVariables.add(match[1]);
  }
  if (typeof process.loadEnvFile === "function") {
    try { process.loadEnvFile(envFile); } catch {}
  }
}

const ip = process.argv[2] || "127.0.0.1";
if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
  console.error("Invalid IP address.");
  process.exit(1);
}

function portFromEnvironment(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`${name} must be an integer from 1 to 65535.`);
    process.exit(1);
  }
  return port;
}

const port = portFromEnvironment("RP_HTTP_PORT", 12067);
const localBackgrounds = {
  visitor: process.env.VP?.trim() || "",
  admin: process.env.AP?.trim() || ""
};
const localBackgroundPaths = Object.fromEntries(Object.entries(localBackgrounds).map(([kind, value]) => {
  const isUrl = /^https?:\/\//i.test(value);
  return [kind, value && !isUrl && path.isAbsolute(value) ? path.resolve(value) : ""];
}));
const backgroundMimeTypes = {
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};
let backgroundServer;

if (Object.values(localBackgroundPaths).some(Boolean)) {
  backgroundServer = createServer((request, response) => {
    const kind = new URL(request.url || "/", "http://localhost").pathname.slice(1);
    const file = localBackgroundPaths[kind];
    if (!file || !["GET", "HEAD"].includes(request.method || "")) {
      response.writeHead(404).end();
      return;
    }
    try {
      if (!statSync(file).isFile()) throw new Error("Not a file");
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": backgroundMimeTypes[path.extname(file).toLowerCase()] || "application/octet-stream",
        "x-content-type-options": "nosniff"
      });
      if (request.method === "HEAD") response.end();
      else createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  backgroundServer.on("error", (error) => {
    console.warn(`Local background image service unavailable: ${error.message}`);
  });
  backgroundServer.listen(12068, "127.0.0.1", () => {
    console.log("Local background images: http://127.0.0.1:12068/");
  });
}

const a = [
  "wrangler", "dev",
  "--config", "dist/server/wrangler.json",
  "--ip", ip,
  "--port", String(port),
  "--local-protocol", "http",
  "--inspector-port", "9231",
  "--show-interactive-dev-session=false"
];
a.push("--var", "RP_LOCAL_BG:1");
if (existsSync(path.resolve(".env"))) a.push("--env-file", ".env");
for (const name of ["VP", "AP", "VPS", "APS"]) {
  const value = process.env[name];
  if (value && !fileConfiguredVariables.has(name)) a.push("--var", `${name}:${value}`);
}
const w = spawn(process.platform === "win32" ? "npx.cmd" : "npx", a, {
  cwd: process.cwd(),
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit"
});

console.log("");
console.log(`Re Player      : http://${ip}:${port}`);
console.log(`Listening      : ${ip}:${port}`);
console.log("");

let closing = false;
let exitCode = 0;
function close(code = 0) {
  if (closing) return;
  closing = true;
  exitCode = code;
  backgroundServer?.close();
  if (!w.killed) {
    if (process.platform === "win32" && w.pid) {
      spawn("taskkill", ["/pid", String(w.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
    } else {
      w.kill("SIGINT");
    }
  }
  setTimeout(() => process.exit(code), 1200).unref();
}

w.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
w.on("exit", (code) => {
  if (closing) return process.exit(exitCode);
  process.exit(code || 0);
});
process.on("SIGINT", () => close(0));
process.on("SIGTERM", () => close(0));
