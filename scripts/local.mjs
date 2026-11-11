import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { isIP } from "node:net";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const localEnvFiles = [".dev.vars", ".env"].filter((file) => existsSync(path.join(projectRoot, file)));
const fileConfiguredVariables = new Set();
for (const file of localEnvFiles) {
  const envFile = path.join(projectRoot, file);
  for (const match of readFileSync(envFile, "utf8").matchAll(/^\s*(?:export\s+)?(VP|AP|VPS|APS)\s*=/gm)) {
    fileConfiguredVariables.add(match[1]);
  }
  if (typeof process.loadEnvFile === "function") {
    try { process.loadEnvFile(envFile); } catch {}
  }
}

const ip = process.argv[2] || "127.0.0.1";
if (isIP(ip) !== 4) {
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
const localMediaToken = randomBytes(32).toString("hex");
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
  ".avi": "video/x-msvideo",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".m2ts": "video/mp2t",
  ".mka": "audio/x-matroska",
  ".mks": "video/x-matroska",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".opus": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};
const mediaMimeTypes = {
  ...backgroundMimeTypes,
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mkv": "video/x-matroska",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".ts": "video/mp2t",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".wma": "audio/x-ms-wma",
  ".wmv": "video/x-ms-wmv"
};

function byteRange(header, size) {
  if (!header) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return null;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

async function scanLocalFolder(input, recursive) {
  if (!path.isAbsolute(input)) throw new Error("Folder path must be absolute.");
  const root = path.resolve(input);
  if (!statSync(root).isDirectory()) throw new Error("The selected path is not a folder.");

  const files = [];
  const pending = [root];
  let visitedEntries = 0;
  while (pending.length) {
    const directory = pending.pop();
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      visitedEntries += 1;
      if (visitedEntries > 100000) throw new Error("The folder contains too many entries to scan.");
      if (entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (recursive) pending.push(file);
        continue;
      }
      if (!entry.isFile()) continue;
      const relativePath = path.relative(root, file).split(path.sep).join("/");
      files.push({ relativePath, url: pathToFileURL(file).href });
      if (files.length > 10000) throw new Error("A folder mount is limited to 10,000 files.");
    }
  }
  return files;
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff"
  }).end(JSON.stringify(value));
}

const backgroundServer = createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", "http://localhost");
  if (requestUrl.pathname === "/scan") {
    if (request.headers["x-rp-local-token"] !== localMediaToken || request.method !== "GET") {
      response.writeHead(404).end();
      return;
    }
    const folder = requestUrl.searchParams.get("path") || "";
    scanLocalFolder(folder, requestUrl.searchParams.get("recursive") === "1")
      .then((files) => sendJson(response, 200, { ok: true, files }))
      .catch((error) => sendJson(response, 400, {
        ok: false,
        error: error instanceof Error ? error.message : "Could not scan the selected folder."
      }));
    return;
  }

  if (requestUrl.pathname === "/media") {
    if (request.headers["x-rp-local-token"] !== localMediaToken || !["GET", "HEAD"].includes(request.method || "")) {
      response.writeHead(404).end();
      return;
    }
    try {
      const source = new URL(requestUrl.searchParams.get("source") || "");
      if (source.protocol !== "file:" || source.host) throw new Error("Invalid local file URL");
      const file = fileURLToPath(source);
      const info = statSync(file);
      if (!info.isFile()) throw new Error("Not a file");
      const range = byteRange(request.headers.range, info.size);
      if (range === null) {
        response.writeHead(416, {
          "accept-ranges": "bytes",
          "content-range": `bytes */${info.size}`,
          "cache-control": "no-store"
        }).end();
        return;
      }
      const start = range?.start ?? 0;
      const end = range?.end ?? Math.max(0, info.size - 1);
      const length = info.size === 0 ? 0 : end - start + 1;
      response.writeHead(range ? 206 : 200, {
        "accept-ranges": "bytes",
        "cache-control": "no-store",
        "content-length": length,
        "content-type": mediaMimeTypes[path.extname(file).toLowerCase()] || "application/octet-stream",
        "x-content-type-options": "nosniff",
        ...(range ? { "content-range": `bytes ${start}-${end}/${info.size}` } : {})
      });
      if (request.method === "HEAD" || length === 0) response.end();
      else createReadStream(file, { start, end }).on("error", () => response.destroy()).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
    return;
  }

  const kind = requestUrl.pathname.slice(1);
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
  console.warn(`Local file service unavailable: ${error.message}`);
});
backgroundServer.listen(12068, "0.0.0.0", () => {
  console.log(`Local file service: http://${ip}:12068/`);
});

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
a.push("--var", `RP_LOCAL_MEDIA_TOKEN:${localMediaToken}`);
a.push("--var", "RP_LOCAL_REQUIRE_D1:1");
const persistencePath = path.join(projectRoot, ".local-data", "wrangler");
mkdirSync(path.dirname(persistencePath), { recursive: true });
a.push("--persist-to", persistencePath);
if (existsSync(path.join(projectRoot, ".env"))) a.push("--env-file", path.join(projectRoot, ".env"));
for (const name of ["VP", "AP", "VPS", "APS"]) {
  const value = process.env[name];
  if (value && !fileConfiguredVariables.has(name)) a.push("--var", `${name}:${value}`);
}
const w = spawn(process.platform === "win32" ? "npx.cmd" : "npx", a, {
  cwd: projectRoot,
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit"
});

console.log("");
console.log(`Re Player      : http://${ip}:${port}`);
console.log(`Listening      : ${ip}:${port}`);
console.log(`Local database : ${persistencePath}`);
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
