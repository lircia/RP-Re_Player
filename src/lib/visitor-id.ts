export const VISITOR_COOKIE = "rp_vid";

function cookieValue(request: Request) {
  const header = request.headers.get("cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${VISITOR_COOKIE}=([^;]+)`));
  return match?.[1] || "";
}

export function ensureVisitorId(request: Request) {
  const current = cookieValue(request).trim();
  if (current && current.length <= 100) return { id: current, setCookie: "" };
  const id = crypto.randomUUID();
  return {
    id,
    setCookie: `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`
  };
}

export function withVisitorCookie(headers: Headers, setCookie: string) {
  if (setCookie) headers.set("set-cookie", setCookie);
  return headers;
}
