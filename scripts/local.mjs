import http from "node:http";
import https from "node:https";
import { spawn } from "node:child_process";

const ip = process.argv[2] || "127.0.0.1";
if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
  console.error("Invalid IP address.");
  process.exit(1);
}

const h = (() => {
  if (ip === "127.0.0.1") return "soers.de5.net";
  const p = ip.split(".");
  const n = Number(p[3]);
  if (n >= 0 && n <= 9 && p.slice(0, 3).join(".") === "127.0.0") return `2${n}.soers.de5.net`;
  if (n >= 0 && n <= 9 && p.slice(0, 3).join(".") === "172.0.0") return `7${n}.soers.de5.net`;
  return ip;
})();

const a = [
  "wrangler", "dev",
  "--config", "dist/server/wrangler.json",
  "--ip", ip,
  "--port", "443",
  "--local-protocol", "https",
  "--inspector-port", "9231"
];
const w = spawn(process.platform === "win32" ? "npx.cmd" : "npx", a, {
  cwd: process.cwd(),
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit"
});

const s = http.createServer((req, res) => {
  const q = https.request({
    hostname: "127.0.0.1",
    port: 443,
    path: req.url,
    method: req.method,
    headers: req.headers,
    rejectUnauthorized: false
  }, (upstream) => {
    res.writeHead(upstream.statusCode || 502, upstream.headers);
    upstream.pipe(res);
  });
  q.on("error", () => {
    if (!res.headersSent) res.writeHead(503, { "content-type": "text/plain; charset=utf-8", "retry-after": "1" });
    res.end("Re Player is starting. Refresh in a moment.");
  });
  req.pipe(q);
});

s.listen(80, ip, () => {
  console.log("");
  console.log(`Re Player HTTP : http://${h}`);
  console.log(`Re Player HTTPS: https://${h}`);
  console.log(`Listening      : ${ip}:80, ${ip}:443`);
  console.log("");
});

let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  s.close(() => process.exit(code));
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
  close(1);
});
w.on("exit", (code) => close(code || 0));
process.on("SIGINT", () => close(0));
process.on("SIGTERM", () => close(0));
