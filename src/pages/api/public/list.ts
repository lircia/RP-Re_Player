import type { APIRoute } from "astro";
import { getEnv, json, jsonError } from "@lib/cloudflare";
import { listPublic } from "@lib/pseudo";

export const POST: APIRoute = async (context) => {
  const env = getEnv(context);
  const body = (await context.request.json().catch(() => ({}))) as Record<string, any>;

  try {
    const result = await listPublic(env, body.path || "/root", body.q || "");
    return json({ ok: true, ...result });
  } catch (error) {
    return jsonError("List failed.", 500, error instanceof Error ? error.message : error);
  }
};
