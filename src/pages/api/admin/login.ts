import type { APIRoute } from "astro";
import { getEnv, json, jsonError } from "@lib/cloudflare";
import { adminCookie, verifyPassword } from "@lib/admin";

export const POST: APIRoute = async (context) => {
  const env = getEnv(context);
  const body = (await context.request.json().catch(() => ({}))) as Record<string, any>;

  if (!(await verifyPassword(env, String(body.password || "")))) {
    return jsonError("Password is incorrect.", 401);
  }

  return json(
    {
      ok: true
    },
    {
      headers: {
        "set-cookie": await adminCookie(env)
      }
    }
  );
};
