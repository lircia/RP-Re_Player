import type { APIRoute } from "astro";
import { json } from "@lib/cloudflare";
import { clearAdminCookie } from "@lib/admin";

export const POST: APIRoute = async () => {
  return json(
    { ok: true },
    {
      headers: {
        "set-cookie": clearAdminCookie()
      }
    }
  );
};
