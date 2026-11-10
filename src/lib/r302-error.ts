import type { AppEnv } from "./cloudflare";

type RequestCf = Request & { cf?: { colo?: string } };

declare global {
  var __RP_FAKE_RAY_IDS__: Map<string, string> | undefined;
}

function memoryRayIds() {
  globalThis.__RP_FAKE_RAY_IDS__ ??= new Map<string, string>();
  return globalThis.__RP_FAKE_RAY_IDS__;
}

function requestIp(request: Request) {
  const candidate = (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    ""
  ).trim();
  return candidate.length <= 64 && /^[0-9a-f:.]+$/i.test(candidate) ? candidate.toLowerCase() : "unknown";
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newRayId(request: Request) {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const id = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  const colo = String((request as RequestCf).cf?.colo || "").toUpperCase();
  return `${id}${/^[A-Z0-9]{3}$/.test(colo) ? `-${colo}` : ""}`;
}

async function rayIdFor(request: Request, env: AppEnv) {
  const ipHash = await sha256(requestIp(request));
  if (env.D1) {
    try {
      await env.D1.prepare(`
        CREATE TABLE IF NOT EXISTS rp_fake_ray_ids (
          ip_hash TEXT PRIMARY KEY,
          ray_id TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `).run();
      const lookup = () => env.D1!.prepare("SELECT ray_id FROM rp_fake_ray_ids WHERE ip_hash = ?").bind(ipHash).first<{ ray_id: string }>();
      const existing = await lookup();
      if (existing?.ray_id) return existing.ray_id;
      const generated = newRayId(request);
      await env.D1.prepare("INSERT OR IGNORE INTO rp_fake_ray_ids (ip_hash, ray_id, created_at) VALUES (?, ?, ?)")
        .bind(ipHash, generated, new Date().toISOString())
        .run();
      const stored = await lookup();
      if (stored?.ray_id) return stored.ray_id;
    } catch {
      // Fall back to per-isolate storage when D1 is unavailable.
    }
  }
  const records = memoryRayIds();
  let rayId = records.get(ipHash);
  if (!rayId) {
    rayId = newRayId(request);
    records.set(ipHash, rayId);
  }
  return rayId;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]!);
}

export function redirectDisabledResponse() {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>502 Bad Gateway</title>
<style>body{margin:0;padding:10vh 8vw;font:16px/1.5 Arial,sans-serif;color:#202124;background:#fff}main{max-width:680px}h1{font-size:32px;font-weight:500}p{color:#5f6368}</style></head>
<body><main><h1>502 Bad Gateway</h1><p>The redirect management page is currently unavailable.</p></main></body></html>`, {
    status: 502,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}

export async function r302MisconfiguredResponse(request: Request, env: AppEnv) {
  const rayId = await rayIdFor(request, env);
  const host = escapeHtml(new URL(request.url).host);
  const fallbackIp = escapeHtml(requestIp(request));
  const time = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>错误 1034：边缘 IP 受限</title>
<style>:root{color-scheme:light;font-family:Arial,"Microsoft YaHei",sans-serif;color:#111;background:#fff;font-synthesis:none;text-rendering:optimizeLegibility}*{box-sizing:border-box}body{margin:0;padding:8px;font-size:16px;line-height:1.5}main{max-width:1200px}h1{margin:48px 0 20px;font-size:36px;line-height:1.2}h2{margin:24px 0 16px;font-size:24px;line-height:1.35}p{margin:0 0 16px}.meta{margin-bottom:22px}.help-block{margin:20px 0}.feedback{margin-top:18px}.feedback button,.ip-toggle{margin-left:4px}.thanks{margin-top:4px}footer{margin-top:30px}a{color:#06c}@media(max-width:600px){body{font-size:15px}h1{margin-top:36px;font-size:30px}h2{font-size:21px}.meta{overflow-wrap:anywhere}}</style></head>
<body><div>请启用 cookies。</div><main><h1>错误 1034</h1><p class="meta">Ray ID：<span>${rayId}</span> ・ <span>${time}</span></p>
<h2>边缘 IP 受限</h2><h2>发生了什么？</h2><p>您请求访问的网站页面属于 <a href="https://www.cloudflare.com/" rel="noreferrer">Cloudflare</a> 网络。主机 (<span>${host}</span>) 解析到的 IP 地址，网站所有者无权访问。</p>
<h2>我能做些什么？</h2><section class="help-block"><strong>如果您是本网站的访客：</strong><p>请稍后再试。</p></section><section class="help-block"><strong>如果您是本网站的所有者：</strong><p>请检查您的 DNS 记录，确保它们指向您在注册时被分配的 IP 地址。</p></section>
<div class="feedback">这个页面对您有帮助吗？ <button type="button" data-feedback="yes" aria-pressed="false">是的</button><button type="button" data-feedback="no" aria-pressed="false">不</button><div class="thanks" id="thanks" aria-live="polite">感谢您的反馈！</div></div>
<footer>Cloudflare Ray ID： <strong>${rayId}</strong> ・ 您的 IP 地址： <button class="ip-toggle" id="ip-toggle" type="button" aria-expanded="false">点击显示</button><span id="visitor-ip" data-fallback="${fallbackIp}" hidden></span> ・ 由 <a href="https://www.cloudflare.com/" rel="noreferrer">Cloudflare</a> 提供性能和安全保障</footer></main>
<script>(()=>{const ip=document.getElementById("visitor-ip"),button=document.getElementById("ip-toggle");let value=ip.dataset.fallback||"";ip.textContent=value||"Unavailable";const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);fetch("https://api64.ipify.org?format=json",{cache:"no-store",signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(d=>{if(typeof d.ip==="string"&&d.ip.length<64&&/^[0-9a-f:.]+$/i.test(d.ip))value=d.ip}).catch(()=>{}).finally(()=>{clearTimeout(timer);ip.textContent=value||"Unavailable"});button.addEventListener("click",()=>{const visible=!ip.hidden;ip.hidden=visible;button.setAttribute("aria-expanded",String(!visible));button.textContent=visible?"点击显示":"点击隐藏"});document.querySelectorAll("[data-feedback]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-feedback]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)))}))})()</script></body></html>`;
  return new Response(html, {
    status: 403,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}
