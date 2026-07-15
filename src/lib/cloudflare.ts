import type { APIContext } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";

export interface AppEnv {
  N?: string;
  P?: string;
  US?: string;
  UI?: string;
  UH?: string;
  UD?: string;
  DB?: D1Database;
}

export function getEnv(context: APIContext): AppEnv {
  void context;
  const runtimeEnv = cloudflareEnv as AppEnv;
  return {
    ...(import.meta.env as AppEnv),
    ...runtimeEnv
  };
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), {
    ...init,
    headers
  });
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return json(
    {
      ok: false,
      error: message,
      details
    },
    { status }
  );
}

export function safeName(input: string) {
  return input
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function safeFolder(input: FormDataEntryValue | null) {
  if (typeof input !== "string" || !input.trim()) return "uploads";
  return input
    .split("/")
    .map((part) => safeName(part))
    .filter(Boolean)
    .join("/")
    .slice(0, 220) || "uploads";
}
