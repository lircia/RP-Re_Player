import type { AppEnv } from "./cloudflare";

export type SiteTheme = "retro" | "blue";
export type IntroMode = "a1" | "a2" | "a3" | "off";

declare global {
  var __RP_SITE_THEME__: SiteTheme | undefined;
  var __RP_INTRO__: IntroMode | undefined;
}

function valid(value: unknown): value is SiteTheme {
  return value === "retro" || value === "blue";
}

function validIntro(value: unknown): value is IntroMode {
  return value === "a1" || value === "a2" || value === "a3" || value === "off";
}

async function ensureDb(env: AppEnv) {
  if (!env.DB) return false;
  await env.DB.prepare(
    `
      CREATE TABLE IF NOT EXISTS rp_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `
  ).run();
  return true;
}

export async function getTheme(env: AppEnv): Promise<SiteTheme> {
  if (await ensureDb(env)) {
    const row = await env.DB!.prepare("SELECT value FROM rp_settings WHERE key = 'ui' LIMIT 1")
      .first<{ value: string }>();
    return valid(row?.value) ? row.value : "blue";
  }
  return globalThis.__RP_SITE_THEME__ || "blue";
}

export async function setTheme(env: AppEnv, theme: SiteTheme): Promise<SiteTheme> {
  if (!valid(theme)) throw new Error("Unsupported theme.");
  if (await ensureDb(env)) {
    await env.DB!.prepare(
      `
        INSERT INTO rp_settings (key, value)
        VALUES ('ui', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `
    )
      .bind(theme)
      .run();
  } else {
    globalThis.__RP_SITE_THEME__ = theme;
  }
  return theme;
}

export async function getIntro(env: AppEnv): Promise<IntroMode> {
  if (await ensureDb(env)) {
    const row = await env.DB!.prepare("SELECT value FROM rp_settings WHERE key = 'ia' LIMIT 1")
      .first<{ value: string }>();
    return validIntro(row?.value) ? row.value : "a1";
  }
  return globalThis.__RP_INTRO__ || "a1";
}

export async function setIntro(env: AppEnv, mode: IntroMode): Promise<IntroMode> {
  if (!validIntro(mode)) throw new Error("Unsupported intro mode.");
  if (await ensureDb(env)) {
    await env.DB!.prepare(
      `
        INSERT INTO rp_settings (key, value)
        VALUES ('ia', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `
    )
      .bind(mode)
      .run();
  } else {
    globalThis.__RP_INTRO__ = mode;
  }
  return mode;
}
