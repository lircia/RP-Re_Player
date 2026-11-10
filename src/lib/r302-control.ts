import type { AppEnv } from "./cloudflare";

export type R302Mode = "disabled" | "enabled" | "invalid";

export function r302Mode(env: AppEnv): R302Mode {
  const value = env.R302?.trim() || "0";
  if (value === "0") return "disabled";
  if (value === "1") return "enabled";
  return "invalid";
}

export function isRedirectManagementPath(pathname: string) {
  return pathname === "/302" || pathname.startsWith("/api/admin/redirects/") || pathname === "/api/admin/redirects";
}
