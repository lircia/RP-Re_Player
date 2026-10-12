import type { APIRoute } from "astro";
import { getEnv, json, jsonError } from "@lib/cloudflare";
import { getItem } from "@lib/pseudo";
import { recordMediaStat, type StatEvent } from "@lib/stats";
import { ensureVisitorId, withVisitorCookie } from "@lib/visitor-id";

export const POST: APIRoute = async (context) => {
  const env = await getEnv(context);
  const body = (await context.request.json().catch(() => ({}))) as Record<string, any>;
  if (!body.path) return jsonError("Path is required.", 400);
  if (body.event !== "play" && body.event !== "complete" && body.event !== "progress") return jsonError("Event is invalid.", 400);

  const item = await getItem(env, body.path);
  if (!item) return jsonError("Item was not found.", 404);
  const visitor = ensureVisitorId(context.request);
  const progress = Number(body.progress);
  if (body.event === "progress" && (!Number.isFinite(progress) || progress < 0 || progress > 1)) {
    return jsonError("Progress is invalid.", 400);
  }
  const stat = await recordMediaStat(env, item.path, visitor.id, body.event as StatEvent, progress);
  const headers = withVisitorCookie(new Headers(), visitor.setCookie);
  return json({ ok: true, stat }, { headers });
};
