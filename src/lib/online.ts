import type { AppEnv } from "./cloudflare";
import { safeName } from "./cloudflare";

interface MetingTrack {
  name?: string;
  title?: string;
  artist?: string;
  author?: string;
  url?: string;
  pic?: string;
  cover?: string;
  lrc?: string;
}

export interface OnlineItem {
  id: string;
  name: string;
  path: string;
  url: string;
  kind: "audio";
  artist?: string;
  poster?: string;
  sub?: string;
  lrc?: string;
  lrc2?: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_PLAYLIST = "17810937506";
const DEFAULT_NAME = "在线音乐";
const API_TEMPLATES = [
  "https://api.injahow.cn/meting/?server=netease&type=playlist&id=:id",
  "https://api.moeyao.cn/meting/?server=netease&type=playlist&id=:id",
  "https://api.i-meto.com/meting/api?server=netease&type=playlist&id=:id&r=:r"
];

let cachedKey = "";
let cachedUntil = 0;
let cachedTracks: OnlineItem[] = [];

function playlistId(env: AppEnv) {
  const value = String(env.M || DEFAULT_PLAYLIST).trim();
  return /^[a-z0-9_-]{1,80}$/i.test(value) ? value : DEFAULT_PLAYLIST;
}

export function onlineEnabled(env: AppEnv) {
  return ["1", "true", "yes", "on"].includes(String(env.I || "").trim().toLowerCase());
}

export function onlineName(env: AppEnv) {
  const value = String(env.H || DEFAULT_NAME).trim() || DEFAULT_NAME;
  return safeName(value) || DEFAULT_NAME;
}

export function onlineRoot(env: AppEnv) {
  return `/root/${onlineName(env)}`;
}

function httpUrl(value: unknown) {
  const input = String(value || "").trim();
  if (!input) return undefined;
  try {
    const url = new URL(input.startsWith("//") ? `https:${input}` : input);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function trackPath(root: string, index: number, name: string) {
  return `${root}/${String(index + 1).padStart(3, "0")} ${safeName(name) || "Track"}.mp3`;
}

function mapTracks(data: unknown, root: string): OnlineItem[] {
  const rows = Array.isArray(data) ? data : [];
  return rows.flatMap((row, index) => {
    const track = row as MetingTrack;
    const url = httpUrl(track.url);
    if (!url) return [];
    const name = String(track.name || track.title || `Track ${index + 1}`).trim();
    const now = new Date(0).toISOString();
    return [{
      id: `online:${index}`,
      name,
      path: trackPath(root, index, name),
      url,
      kind: "audio" as const,
      artist: String(track.artist || track.author || "").trim() || undefined,
      poster: httpUrl(track.pic || track.cover),
      lrc: httpUrl(track.lrc),
      createdAt: now,
      updatedAt: now
    }];
  });
}

async function requestPlaylist(template: string, id: string, root: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const url = template.replace(":id", encodeURIComponent(id)).replace(":r", String(Date.now()));
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Meting returned ${response.status}.`);
    const tracks = mapTracks(await response.json(), root);
    if (!tracks.length) throw new Error("Meting returned no playable tracks.");
    return tracks;
  } finally {
    clearTimeout(timer);
  }
}

export async function onlinePlaylist(env: AppEnv) {
  if (!onlineEnabled(env)) throw new Error("Online music is disabled.");
  const id = playlistId(env);
  const root = onlineRoot(env);
  const key = `${id}\n${root}`;
  if (key === cachedKey && cachedUntil > Date.now() && cachedTracks.length) return cachedTracks;

  let lastError: unknown;
  for (const template of API_TEMPLATES) {
    try {
      const tracks = await requestPlaylist(template, id, root);
      cachedKey = key;
      cachedUntil = Date.now() + 5 * 60 * 1000;
      cachedTracks = tracks;
      return tracks;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Online music is unavailable.");
}

export async function getOnlineItem(env: AppEnv, path: string) {
  if (!onlineEnabled(env)) return null;
  const root = onlineRoot(env);
  if (!path.startsWith(`${root}/`)) return null;
  const tracks = await onlinePlaylist(env);
  const exact = tracks.find((track) => track.path === path);
  if (exact) return exact;
  const index = Number(path.slice(root.length + 1).match(/^(\d{3}) /)?.[1]) - 1;
  return Number.isInteger(index) ? tracks[index] ?? null : null;
}
