import type { APIRoute } from "astro";
import { getEnv, json, jsonError } from "@lib/cloudflare";
import { isAdmin } from "@lib/admin";
import { deleteItem } from "@lib/pseudo";

export const POST: APIRoute = async (context) => {
  const env = await getEnv(context);
  if (!(await isAdmin(context.request, env))) return jsonError("Admin login is required.", 401);

  const body = (await context.request.json().catch(() => ({}))) as Record<string, any>;
  if (!body.id && !body.path) return jsonError("id or path is required.", 400);
  await deleteItem(env, body.id || body.path);
  return json({ ok: true });
};
