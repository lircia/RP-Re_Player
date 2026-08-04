import type { AppEnv } from "./cloudflare";

export const visitorThemes = ["blue", "retro", "future", "tech", "gray"] as const;
export type VisitorTheme = (typeof visitorThemes)[number];

const legacyThemes: Record<string, VisitorTheme> = {
  default: "blue",
  azure: "future",
  newblue: "tech",
  lightgray: "gray"
};

export function normalizeVisitorTheme(value: unknown): VisitorTheme {
  const theme = String(value || "").toLowerCase();
  if (visitorThemes.includes(theme as VisitorTheme)) return theme as VisitorTheme;
  return legacyThemes[theme] || "blue";
}

async function ensureSettings(env: AppEnv) {
  if (!env.DB) return false;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS rp_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
  return true;
}

export async function getVisitorTheme(env: AppEnv): Promise<VisitorTheme> {
  if (!(await ensureSettings(env))) return "blue";
  const row = await env.DB!.prepare("SELECT value FROM rp_settings WHERE key = ?")
    .bind("visitor_theme")
    .first<{ value: string }>();
  return normalizeVisitorTheme(row?.value);
}

export async function setVisitorTheme(env: AppEnv, value: unknown): Promise<VisitorTheme> {
  const theme = normalizeVisitorTheme(value);
  if (!(await ensureSettings(env))) return theme;
  await env.DB!.prepare(`
    INSERT INTO rp_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).bind("visitor_theme", theme, Date.now()).run();
  return theme;
}

export function nextVisitorTheme(current: unknown): VisitorTheme {
  const theme = normalizeVisitorTheme(current);
  return visitorThemes[(visitorThemes.indexOf(theme) + 1) % visitorThemes.length];
}
