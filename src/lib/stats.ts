import type { AppEnv } from "./cloudflare";

export type StatEvent = "play" | "complete";

export interface MediaStat {
  plays: number;
  completions: number;
  rate: number;
}

type StatRow = {
  plays: number;
  completions: number;
};

declare global {
  var __RP_MEDIA_STATS__: Record<string, StatRow> | undefined;
}

function memory() {
  globalThis.__RP_MEDIA_STATS__ ??= {};
  return globalThis.__RP_MEDIA_STATS__;
}

function result(row?: Partial<StatRow> | null): MediaStat {
  const plays = Math.max(0, Number(row?.plays) || 0);
  const completions = Math.min(plays, Math.max(0, Number(row?.completions) || 0));
  return {
    plays,
    completions,
    rate: plays ? Math.round((completions / plays) * 1000) / 10 : 0
  };
}

async function ensureDb(env: AppEnv) {
  if (!env.DB) return false;
  await env.DB.prepare(
    `
      CREATE TABLE IF NOT EXISTS rp_media_stats (
        path TEXT PRIMARY KEY,
        plays INTEGER NOT NULL DEFAULT 0,
        completions INTEGER NOT NULL DEFAULT 0
      )
    `
  ).run();
  return true;
}

export async function getMediaStat(env: AppEnv, path: string): Promise<MediaStat> {
  if (await ensureDb(env)) {
    const row = await env.DB!.prepare(
      "SELECT plays, completions FROM rp_media_stats WHERE path = ? LIMIT 1"
    )
      .bind(path)
      .first<StatRow>();
    return result(row);
  }
  return result(memory()[path]);
}

export async function recordMediaStat(env: AppEnv, path: string, event: StatEvent): Promise<MediaStat> {
  if (await ensureDb(env)) {
    if (event === "play") {
      await env.DB!.prepare(
        `
          INSERT INTO rp_media_stats (path, plays, completions)
          VALUES (?, 1, 0)
          ON CONFLICT(path) DO UPDATE SET plays = plays + 1
        `
      )
        .bind(path)
        .run();
    } else {
      await env.DB!.prepare(
        `
          INSERT INTO rp_media_stats (path, plays, completions)
          VALUES (?, 0, 0)
          ON CONFLICT(path) DO UPDATE SET
            completions = CASE
              WHEN completions < plays THEN completions + 1
              ELSE completions
            END
        `
      )
        .bind(path)
        .run();
    }
    return getMediaStat(env, path);
  }

  const state = memory();
  const row = state[path] ?? { plays: 0, completions: 0 };
  if (event === "play") row.plays += 1;
  else if (row.completions < row.plays) row.completions += 1;
  state[path] = row;
  return result(row);
}
