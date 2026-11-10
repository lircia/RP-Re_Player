import type { MiddlewareHandler } from "astro";
import { getEnv } from "@lib/cloudflare";
import { routeForChinaCloudIp } from "@lib/ip";
import { isRedirectManagementPath, r302Mode } from "@lib/r302-control";
import { r302MisconfiguredResponse, redirectDisabledResponse } from "@lib/r302-error";
import { redirectTargetForPublicPath } from "@lib/redirect-mounts";

export const onRequest: MiddlewareHandler = async (context, next) => {
  const pathname = context.url.pathname;
  const lowerPath = pathname.toLocaleLowerCase();
  const env = await getEnv(context);
  const mode = r302Mode(env);
  if (mode === "invalid") return r302MisconfiguredResponse(context.request, env);
  if (isRedirectManagementPath(pathname) && mode !== "enabled") return redirectDisabledResponse();

  if (
    mode === "enabled" &&
    (lowerPath.startsWith("/local/pash/") || lowerPath.startsWith("/loacl/pash/") || lowerPath === "/tree" || lowerPath.startsWith("/tree/"))
  ) {
    const target = await redirectTargetForPublicPath(env, pathname);
    if (target && target !== pathname) return Response.redirect(new URL(target, context.url), 302);
  }

  const publicEntry = pathname === "/" || pathname === "/Re" || pathname === "/Local" || pathname.startsWith("/Local/") || pathname === "/Loading" || pathname === "/Tree" || pathname.startsWith("/Tree/") || pathname === "/tree" || pathname.startsWith("/tree/");
  if (publicEntry && (context.request.method === "GET" || context.request.method === "HEAD")) {
    const redirect = await routeForChinaCloudIp(context.request, env);
    if (redirect) return Response.redirect(redirect, 302);
  }
  if (pathname === "/Tree" || pathname.startsWith("/Tree/")) {
    return context.rewrite(new URL(`/tree${pathname.slice("/Tree".length)}`, context.url));
  }
  return next();
};
