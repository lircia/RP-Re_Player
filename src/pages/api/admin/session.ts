import type { APIRoute } from "astro";
import { getEnv, json } from "@lib/cloudflare";
import { isAdmin } from "@lib/admin";

export const GET: APIRoute = async (context) => {
  const env = await getEnv(context);
  return json({
    ok: true,
    loggedIn: await isAdmin(context.request, env)
  });
};
