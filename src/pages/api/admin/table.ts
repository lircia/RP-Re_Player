import type { APIRoute } from "astro";
import { getEnv, json, jsonError } from "@lib/cloudflare";
import { isAdmin } from "@lib/admin";
import { listVisitorEvents, visitorSummary } from "@lib/visitor-events";

export const GET: APIRoute = async (context) => {
  const env = await getEnv(context);
  if (!(await isAdmin(context.request, env))) return jsonError("Admin login is required.", 401);
  return json({ ok: true, summary: await visitorSummary(env), events: await listVisitorEvents(env, 300) });
};
