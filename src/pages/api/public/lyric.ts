import type { APIRoute } from "astro";
import { getEnv, jsonError } from "@lib/cloudflare";
import { getItem } from "@lib/pseudo";

export const GET: APIRoute = async (context) => {
  const path = context.url.searchParams.get("path");
  const slot = context.url.searchParams.get("n") === "2" ? 2 : 1;
  if (!path) return jsonError("Path is required.", 400);

  const item = await getItem(await getEnv(context), path);
  const source = slot === 2 ? item?.lrc2 : item?.lrc;
  if (!source || item?.kind !== "audio") return jsonError("Lyrics were not found.", 404);

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return jsonError("Lyrics URL is invalid.", 400);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return jsonError("Lyrics URL is invalid.", 400);

  try {
    const upstream = await fetch(url, { headers: { accept: "text/plain,*/*;q=0.8" } });
    if (!upstream.ok) return jsonError("Lyrics source failed.", 502, upstream.status);
    return new Response(upstream.body, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=300"
      }
    });
  } catch (error) {
    return jsonError("Lyrics source failed.", 502, error instanceof Error ? error.message : error);
  }
};
