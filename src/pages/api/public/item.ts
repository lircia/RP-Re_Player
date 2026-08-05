import type { APIRoute } from "astro";
import { getEnv, json, jsonError } from "@lib/cloudflare";
import { getItem, publicMediaPath } from "@lib/pseudo";
import { getMediaStat } from "@lib/stats";

export const POST: APIRoute = async (context) => {
  const env = await getEnv(context);
  const body = (await context.request.json().catch(() => ({}))) as Record<string, any>;
  if (!body.path) return jsonError("Path is required.", 400);

  const item = await getItem(env, body.path);
  if (!item) return jsonError("Item was not found.", 404);
  const stat = await getMediaStat(env, item.path);
  return json({ ok: true, item: { ...item, url: publicMediaPath(item.path) }, stat });
};
