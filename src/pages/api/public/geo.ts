import type { APIRoute } from "astro";
import { json } from "@lib/cloudflare";

type CfRequest = Request & { cf?: { country?: string } };

function publicIp(request: Request) {
  const value = (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "").trim();
  if (!value || value.length > 64 || !/^[0-9a-f:.]+$/i.test(value)) return "";
  if (
    value === "::1" ||
    value.startsWith("127.") ||
    value.startsWith("10.") ||
    value.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(value) ||
    /^(fc|fd|fe8|fe9|fea|feb)/i.test(value)
  ) {
    return "";
  }
  return value;
}

function language(country: string) {
  if (country === "CN") return "zh";
  if (country === "JP") return "ja";
  return "en";
}

export const GET: APIRoute = async (context) => {
  const cfCountry = String((context.request as CfRequest).cf?.country || "").toUpperCase();
  const ip = publicIp(context.request);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  try {
    const suffix = ip ? `/${encodeURIComponent(ip)}` : "/";
    const response = await fetch(`https://api.country.is${suffix}`, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Country lookup returned ${response.status}.`);
    const data = (await response.json()) as { country?: string };
    const country = String(data.country || cfCountry || "").toUpperCase();
    return json(
      { ok: true, country, lang: language(country) },
      { headers: { "cache-control": "private, max-age=21600" } }
    );
  } catch {
    return json(
      { ok: true, country: cfCountry, lang: language(cfCountry) },
      { headers: { "cache-control": "private, max-age=600" } }
    );
  } finally {
    clearTimeout(timer);
  }
};
