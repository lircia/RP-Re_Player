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

async function ensureThemeTable(env: AppEnv) {
  if (!env.DB) return false;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS rp_visitor_theme (
      id INTEGER PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).run();
  return true;
}

export async function getVisitorTheme(env: AppEnv): Promise<VisitorTheme> {
  if (!(await ensureThemeTable(env))) return "blue";
  const row = await env.DB!.prepare("SELECT value FROM rp_visitor_theme WHERE id = 1")
    .first<{ value: string }>();
  if (row?.value) return normalizeVisitorTheme(row.value);

  const legacy = await env.DB!.prepare("SELECT value FROM rp_settings WHERE key = ?")
    .bind("visitor_theme")
    .first<{ value: string }>()
    .catch(() => null);
  const theme = normalizeVisitorTheme(legacy?.value);
  if (legacy?.value) {
    await env.DB!.prepare("INSERT OR REPLACE INTO rp_visitor_theme (id, value) VALUES (1, ?)")
      .bind(theme)
      .run();
  }
  return theme;
}

export async function setVisitorTheme(env: AppEnv, value: unknown): Promise<VisitorTheme> {
  const theme = normalizeVisitorTheme(value);
  if (!(await ensureThemeTable(env))) return theme;
  await env.DB!.prepare("INSERT OR REPLACE INTO rp_visitor_theme (id, value) VALUES (1, ?)")
    .bind(theme)
    .run();
  return theme;
}

export function nextVisitorTheme(current: unknown): VisitorTheme {
  const theme = normalizeVisitorTheme(current);
  return visitorThemes[(visitorThemes.indexOf(theme) + 1) % visitorThemes.length];
}
