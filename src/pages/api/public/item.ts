import type { APIRoute } from "astro";
import { getEnv, json, jsonError } from "@lib/cloudflare";
import { getItem, publicDownloadPath, publicMediaPath } from "@lib/pseudo";
import { getMediaStat } from "@lib/stats";
import { ensureVisitorId, withVisitorCookie } from "@lib/visitor-id";

export const POST: APIRoute = async (context) => {
  const env = await getEnv(context);
  const body = (await context.request.json().catch(() => ({}))) as Record<string, any>;
  if (!body.path) return jsonError("Path is required.", 400);

  const item = await getItem(env, body.path);
  if (!item) return jsonError("Item was not found.", 404);
  const visitor = ensureVisitorId(context.request);
  const stat = await getMediaStat(env, item.path, visitor.id);
  const url = item.kind === "file" ? publicDownloadPath(item.path) : publicMediaPath(item.path);
  const headers = withVisitorCookie(new Headers(), visitor.setCookie);
  return json({ ok: true, item: { ...item, url }, stat }, { headers });
};
