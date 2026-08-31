import type { AppEnv } from "./cloudflare";

export type VisitorEvent = "visit" | "directory" | "media" | "play";

export interface VisitorEventRow {
  id: string;
  event: VisitorEvent;
  path: string;
  ip: string;
  country: string;
  createdAt: string;
}

type CfRequest = Request & { cf?: { country?: string } };

declare global {
  var __RP_VISITOR_EVENTS__: VisitorEventRow[] | undefined;
}

function memory() {
  globalThis.__RP_VISITOR_EVENTS__ ??= [];
  return globalThis.__RP_VISITOR_EVENTS__;
}

function clientIp(request: Request) {
  const value = (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "").trim();
  if (!value || value.length > 64 || !/^[0-9a-f:.]+$/i.test(value)) return "";
  if (value === "::1" || value.startsWith("127.") || value.startsWith("10.") || value.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(value) || /^(fc|fd|fe8|fe9|fea|feb)/i.test(value)) return "";
  return value;
}

async function countryFor(request: Request, ip: string) {
  const fallback = String((request as CfRequest).cf?.country || "").toUpperCase().slice(0, 8);
  if (!ip) return fallback;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1800);
  try {
    const response = await fetch(`https://api.country.is/${encodeURIComponent(ip)}`, { headers: { accept: "application/json" }, signal: controller.signal });
    if (!response.ok) return fallback;
    const data = (await response.json()) as { country?: string };
    return String(data.country || fallback).toUpperCase().slice(0, 8);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

async function ensureDb(env: AppEnv) {
  if (!env.DB) return false;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS rp_visitor_events (
    id TEXT PRIMARY KEY,
    event TEXT NOT NULL,
    path TEXT NOT NULL,
    ip TEXT,
    country TEXT,
    created_at TEXT NOT NULL
  )`).run();
  return true;
}

export async function recordVisitorEvent(env: AppEnv, request: Request, event: VisitorEvent, path: string) {
  const normalizedPath = String(path || "/").slice(0, 500);
  const row: VisitorEventRow = {
    id: crypto.randomUUID(),
    event,
    path: normalizedPath,
    ip: clientIp(request),
    country: await countryFor(request, clientIp(request)),
    createdAt: new Date().toISOString()
  };
  if (await ensureDb(env)) {
    await env.DB!.prepare("INSERT INTO rp_visitor_events (id, event, path, ip, country, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(row.id, row.event, row.path, row.ip, row.country, row.createdAt).run();
  } else {
    memory().unshift(row);
    memory().splice(5000);
  }
  return row;
}

export async function listVisitorEvents(env: AppEnv, limit = 200) {
  const safeLimit = Math.min(500, Math.max(1, Math.floor(limit)));
  if (await ensureDb(env)) {
    const result = await env.DB!.prepare("SELECT id, event, path, ip, country, created_at FROM rp_visitor_events ORDER BY created_at DESC LIMIT ?").bind(safeLimit).all<any>();
    return (result.results ?? []).map((row) => ({ id: row.id, event: row.event, path: row.path, ip: row.ip || "", country: row.country || "", createdAt: row.created_at }));
  }
  return memory().slice(0, safeLimit);
}

export async function visitorSummary(env: AppEnv) {
  if (await ensureDb(env)) {
    const result = await env.DB!.prepare("SELECT event, COUNT(*) AS count FROM rp_visitor_events GROUP BY event ORDER BY count DESC").all<{ event: string; count: number }>();
    return (result.results ?? []).map((row) => ({ event: row.event, count: Number(row.count) || 0 }));
  }
  const counts = new Map<string, number>();
  for (const row of memory()) counts.set(row.event, (counts.get(row.event) || 0) + 1);
  return [...counts.entries()].map(([event, count]) => ({ event, count }));
}
