import type { APIRoute } from "astro";
import { getEnv, jsonError } from "@lib/cloudflare";
import { getItem } from "@lib/pseudo";

export const GET: APIRoute = async (context) => {
  const path = context.url.searchParams.get("path");
  if (!path) return jsonError("Path is required.", 400);

  const item = await getItem(getEnv(context), path);
  if (!item?.sub || item.kind !== "video") return jsonError("Subtitle was not found.", 404);

  let url: URL;
  try {
    url = new URL(item.sub);
  } catch {
    return jsonError("Subtitle URL is invalid.", 400);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return jsonError("Subtitle URL is invalid.", 400);

  try {
    const upstream = await fetch(url, { headers: { accept: "text/plain,*/*;q=0.8" } });
    if (!upstream.ok) return jsonError("Subtitle source failed.", 502, upstream.status);
    return new Response(upstream.body, {
      headers: {
        "content-type": "text/x-ssa; charset=utf-8",
        "cache-control": "public, max-age=300"
      }
    });
  } catch (error) {
    return jsonError("Subtitle source failed.", 502, error instanceof Error ? error.message : error);
  }
};
