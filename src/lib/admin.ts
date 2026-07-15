import type { AppEnv } from "./cloudflare";

const COOKIE_NAME = "rp_admin";

async function digest(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function adminToken(env: AppEnv) {
  const password = env.P || "masteradmin";
  return digest(`rp:${password}`);
}

export async function verifyPassword(env: AppEnv, password: string) {
  return (env.P || "masteradmin") === password;
}

export async function isAdmin(request: Request, env: AppEnv) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match?.[1] === (await adminToken(env));
}

export async function adminCookie(env: AppEnv) {
  return `${COOKIE_NAME}=${await adminToken(env)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;
}

export function clearAdminCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
