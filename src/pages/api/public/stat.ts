import type { APIRoute } from "astro";
import { getEnv, json, jsonError } from "@lib/cloudflare";
import { getItem } from "@lib/pseudo";
import { recordMediaStat, type StatEvent } from "@lib/stats";

export const POST: APIRoute = async (context) => {
  const env = await getEnv(context);
  const body = (await context.request.json().catch(() => ({}))) as Record<string, any>;
  if (!body.path) return jsonError("Path is required.", 400);
  if (body.event !== "play" && body.event !== "complete") return jsonError("Event is invalid.", 400);

  const item = await getItem(env, body.path);
  if (!item) return jsonError("Item was not found.", 404);
  const stat = await recordMediaStat(env, item.path, body.event as StatEvent);
  return json({ ok: true, stat });
};
