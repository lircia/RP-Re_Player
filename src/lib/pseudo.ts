import type { AppEnv } from "./cloudflare";
import { getOnlineItem, onlineEnabled, onlineName, onlinePlaylist, onlineRoot } from "./online";

export type PseudoKind = "video" | "audio" | "image";

export interface PseudoItem {
  id: string;
  name: string;
  path: string;
  url: string;
  kind: PseudoKind;
  artist?: string;
  poster?: string;
  sub?: string;
  lrc?: string;
  lrc2?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicNode {
  name: string;
  path: string;
  isDir: boolean;
  kind?: PseudoKind;
  artist?: string;
  poster?: string;
  sub?: string;
  updatedAt?: string;
}

type MemoryState = {
  items: PseudoItem[];
};

declare global {
  var __RP_PSEUDO_STATE__: MemoryState | undefined;
}

function memory() {
  globalThis.__RP_PSEUDO_STATE__ ??= { items: [] };
  return globalThis.__RP_PSEUDO_STATE__;
}

export function normalizeRootPath(path: string) {
  const normalized = `/${String(path || "/root")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/")}`;

  if (normalized === "/") return "/root";
  if (normalized === "/root" || normalized.startsWith("/root/")) return normalized;
  return `/root/${normalized.replace(/^\/+/, "")}`;
}

export function safeFileName(input: string) {
  return String(input || "untitled")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function webUrl(input: string, label: string) {
  const value = String(input || "").trim();
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${label} must use HTTP or HTTPS.`);
  }
  return url.href;
}

function parentPath(path: string) {
  const parts = normalizeRootPath(path).split("/").filter(Boolean);
  parts.pop();
  return `/${parts.join("/")}` || "/root";
}

async function ensureDb(env: AppEnv) {
  if (!env.DB) return false;
  await env.DB.prepare(
    `
      CREATE TABLE IF NOT EXISTS rp_pseudo_links (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
        kind TEXT NOT NULL,
        poster TEXT,
        sub TEXT,
        lrc TEXT,
        lrc2 TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `
  ).run();

  const info = await env.DB.prepare("PRAGMA table_info(rp_pseudo_links)").all<{ name: string }>();
  if (!(info.results ?? []).some((column) => column.name === "sub")) {
    await env.DB.prepare("ALTER TABLE rp_pseudo_links ADD COLUMN sub TEXT").run();
  }
  if (!(info.results ?? []).some((column) => column.name === "lrc")) {
    await env.DB.prepare("ALTER TABLE rp_pseudo_links ADD COLUMN lrc TEXT").run();
  }
  if (!(info.results ?? []).some((column) => column.name === "lrc2")) {
    await env.DB.prepare("ALTER TABLE rp_pseudo_links ADD COLUMN lrc2 TEXT").run();
  }
  return true;
}

function mapRow(row: any): PseudoItem {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    url: row.url,
    kind: row.kind,
    poster: row.poster || undefined,
    sub: row.sub || undefined,
    lrc: row.lrc || undefined,
    lrc2: row.lrc2 || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function allItems(env: AppEnv): Promise<PseudoItem[]> {
  if (await ensureDb(env)) {
    const result = await env.DB!.prepare(
      "SELECT id, name, path, url, kind, poster, sub, lrc, lrc2, created_at, updated_at FROM rp_pseudo_links ORDER BY path ASC"
    ).all<any>();
    return (result.results ?? []).map(mapRow);
  }
  return [...memory().items].sort((a, b) => a.path.localeCompare(b.path, "zh-CN"));
}

export async function listPublic(env: AppEnv, path = "/root") {
  const current = normalizeRootPath(path);
  const onlinePath = onlineRoot(env);
  if (onlineEnabled(env) && current === onlinePath) {
    const tracks = await onlinePlaylist(env);
    return {
      path: current,
      items: tracks.map((track) => ({
        name: track.name,
        path: track.path,
        isDir: false,
        kind: track.kind,
        artist: track.artist,
        poster: track.poster,
        updatedAt: track.updatedAt
      }))
    };
  }

  const items = await allItems(env);
  const children = new Map<string, PublicNode>();

  for (const item of items) {
    if (!item.path.startsWith(current === "/root" ? "/root/" : `${current}/`)) continue;
    const rest = item.path.slice(current.length).replace(/^\/+/, "");
    if (!rest) continue;

    const [first, ...remaining] = rest.split("/");
    if (remaining.length > 0) {
      const folderPath = `${current}/${first}`;
      children.set(folderPath, {
        name: first,
        path: folderPath,
        isDir: true
      });
    } else {
      children.set(item.path, {
        name: item.name,
        path: item.path,
        isDir: false,
        kind: item.kind,
        poster: item.poster,
        sub: item.sub,
        updatedAt: item.updatedAt
      });
    }
  }

  if (current === "/root" && onlineEnabled(env)) {
    children.set(onlinePath, {
      name: onlineName(env),
      path: onlinePath,
      isDir: true
    });
  }

  return {
    path: current,
    items: [...children.values()].sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name, "zh-CN"))
  };
}

export async function getItem(env: AppEnv, path: string) {
  const normalized = normalizeRootPath(path);
  const online = await getOnlineItem(env, normalized);
  if (online) return online;
  if (await ensureDb(env)) {
    const row = await env.DB!.prepare(
      "SELECT id, name, path, url, kind, poster, sub, lrc, lrc2, created_at, updated_at FROM rp_pseudo_links WHERE path = ? LIMIT 1"
    )
      .bind(normalized)
      .first<any>();
    return row ? mapRow(row) : null;
  }
  return memory().items.find((item) => item.path === normalized) ?? null;
}

export async function createItem(
  env: AppEnv,
  input: {
    folder: string;
    name: string;
    url: string;
    kind: PseudoKind;
    poster?: string;
    sub?: string;
    lrc?: string;
    lrc2?: string;
  }
) {
  const folder = normalizeRootPath(input.folder || "/root");
  const name = safeFileName(input.name);
  if (!name) throw new Error("Name is required.");
  const path = `${folder.replace(/\/+$/, "")}/${name}`;
  const now = new Date().toISOString();
  const item: PseudoItem = {
    id: crypto.randomUUID(),
    name,
    path,
    url: webUrl(input.url, "Media URL") || "",
    kind: input.kind === "image" || input.kind === "audio" ? input.kind : "video",
    poster: webUrl(input.poster || "", "Poster URL"),
    sub: input.kind === "video" ? webUrl(input.sub || "", "Subtitle URL") : undefined,
    lrc: input.kind === "audio" ? webUrl(input.lrc || "", "Lyrics URL") : undefined,
    lrc2: input.kind === "audio" ? webUrl(input.lrc2 || "", "Other lyrics URL") : undefined,
    createdAt: now,
    updatedAt: now
  };

  if (!item.url) throw new Error("URL is required.");

  if (await ensureDb(env)) {
    await env.DB!.prepare(
      `
        INSERT INTO rp_pseudo_links (id, name, path, url, kind, poster, sub, lrc, lrc2, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          name = excluded.name,
          url = excluded.url,
          kind = excluded.kind,
          poster = excluded.poster,
          sub = excluded.sub,
          lrc = excluded.lrc,
          lrc2 = excluded.lrc2,
          updated_at = excluded.updated_at
      `
    )
      .bind(
        item.id,
        item.name,
        item.path,
        item.url,
        item.kind,
        item.poster ?? null,
        item.sub ?? null,
        item.lrc ?? null,
        item.lrc2 ?? null,
        now,
        now
      )
      .run();
  } else {
    const state = memory();
    state.items = [item, ...state.items.filter((existing) => existing.path !== item.path)];
  }

  return item;
}

export async function deleteItem(env: AppEnv, pathOrId: string) {
  if (await ensureDb(env)) {
    await env.DB!.prepare("DELETE FROM rp_pseudo_links WHERE id = ? OR path = ?")
      .bind(pathOrId, normalizeRootPath(pathOrId))
      .run();
  } else {
    const state = memory();
    const normalized = normalizeRootPath(pathOrId);
    state.items = state.items.filter((item) => item.id !== pathOrId && item.path !== normalized);
  }

  return true;
}

export { parentPath };
