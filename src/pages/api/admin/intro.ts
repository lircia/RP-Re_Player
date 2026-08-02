import type { APIRoute } from "astro";
import { isAdmin } from "@lib/admin";
import { getEnv, json, jsonError } from "@lib/cloudflare";
import { getIntro, setIntro, type IntroMode } from "@lib/theme";

export const GET: APIRoute = async (context) => {
  const env = getEnv(context);
  if (!(await isAdmin(context.request, env))) return jsonError("Admin login is required.", 401);
  return json({ ok: true, mode: await getIntro(env) });
};

export const POST: APIRoute = async (context) => {
  const env = getEnv(context);
  if (!(await isAdmin(context.request, env))) return jsonError("Admin login is required.", 401);
  const body = (await context.request.json().catch(() => ({}))) as { mode?: IntroMode };
  if (body.mode !== "a1" && body.mode !== "a2" && body.mode !== "a3" && body.mode !== "off") {
    return jsonError("Unsupported intro mode.");
  }
  return json({ ok: true, mode: await setIntro(env, body.mode) });
};
