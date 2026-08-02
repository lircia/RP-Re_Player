import type { APIRoute } from "astro";
import { isAdmin } from "@lib/admin";
import { getEnv, json, jsonError } from "@lib/cloudflare";
import { getTheme, setTheme, type SiteTheme } from "@lib/theme";

export const GET: APIRoute = async (context) => {
  const env = getEnv(context);
  if (!(await isAdmin(context.request, env))) return jsonError("Admin login is required.", 401);
  return json({ ok: true, theme: await getTheme(env) });
};

export const POST: APIRoute = async (context) => {
  const env = getEnv(context);
  if (!(await isAdmin(context.request, env))) return jsonError("Admin login is required.", 401);
  const body = (await context.request.json().catch(() => ({}))) as { theme?: SiteTheme };
  if (body.theme !== "retro" && body.theme !== "blue") return jsonError("Unsupported theme.");
  return json({ ok: true, theme: await setTheme(env, body.theme) });
};
