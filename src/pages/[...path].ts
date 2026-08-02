import type { APIContext, APIRoute } from "astro";
import { getEnv } from "@lib/cloudflare";
import { getItem, normalizeRootPath, publicMediaPath } from "@lib/pseudo";

export const prerender = false;

const forwardedHeaders = ["range", "if-range", "if-none-match", "if-modified-since"];

function mediaType(name: string) {
  const extension = name.toLowerCase().split(".").pop();
  const types: Record<string, string> = {
    mp4: "video/mp4",
    m4v: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    flac: "audio/flac",
    ogg: "audio/ogg",
    wav: "audio/wav",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif"
  };
  return extension ? types[extension] : undefined;
}

function rootPath(url: URL) {
  try {
    const relative = url.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part))
      .join("/");
    return relative ? normalizeRootPath(`/root/${relative}`) : "/root";
  } catch {
    return null;
  }
}

async function serve(context: APIContext, method: "GET" | "HEAD") {
  const path = rootPath(context.url);
  if (!path || path === "/root") return new Response("Not found.", { status: 404 });

  const item = await getItem(getEnv(context), path);
  if (!item) return new Response("Not found.", { status: 404 });

  let source: URL;
  try {
    source = new URL(item.url);
  } catch {
    return new Response("Invalid media source.", { status: 502 });
  }

  if ((source.protocol !== "http:" && source.protocol !== "https:") ||
      (source.origin === context.url.origin && source.pathname === publicMediaPath(item.path))) {
    return new Response("Invalid media source.", { status: 502 });
  }

  const requestHeaders = new Headers();
  for (const name of forwardedHeaders) {
    const value = context.request.headers.get(name);
    if (value) requestHeaders.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(source, { method, headers: requestHeaders, redirect: "follow" });
  } catch {
    return new Response("Media source is unavailable.", { status: 502 });
  }

  const headers = new Headers(upstream.headers);
  headers.delete("set-cookie");
  headers.delete("set-cookie2");
  const contentType = headers.get("content-type")?.toLowerCase() || "";
  if (!contentType || contentType.startsWith("application/octet-stream")) {
    const inferredType = mediaType(item.name);
    if (inferredType) headers.set("content-type", inferredType);
  }
  headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(item.name)}`);

  return new Response(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}

export const GET: APIRoute = (context) => serve(context, "GET");
export const HEAD: APIRoute = (context) => serve(context, "HEAD");
