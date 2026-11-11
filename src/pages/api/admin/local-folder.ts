import type { APIRoute } from "astro";
import { getEnv, json, jsonError } from "@lib/cloudflare";
import { isAdmin } from "@lib/admin";
import { createLocalFolderItems, normalizeRootPath, safeFileName, type LocalFolderFile } from "@lib/pseudo";

export const POST: APIRoute = async (context) => {
  const env = await getEnv(context);
  if (!(await isAdmin(context.request, env))) return jsonError("Admin login is required.", 401);
  if (env.RP_LOCAL_BG !== "1" || !env.RP_LOCAL_MEDIA_TOKEN) {
    return jsonError("Local folder mounts are available only in the Local version.", 400);
  }

  const body = (await context.request.json().catch(() => ({}))) as Record<string, any>;
  const sourcePath = String(body.url || "").trim();
  const mountName = safeFileName(String(body.name || ""));
  const isAbsoluteLocalPath = /^[a-z]:[\\/]/i.test(sourcePath) || (sourcePath.startsWith("/") && !sourcePath.startsWith("//"));
  if (!isAbsoluteLocalPath) return jsonError("Enter an absolute local folder path.", 400);
  if (!mountName) return jsonError("Folder name is required.", 400);

  const scanUrl = new URL("http://127.0.0.1:12068/scan");
  scanUrl.searchParams.set("path", sourcePath);
  scanUrl.searchParams.set("recursive", body.recursive === true || body.recursive === "1" || body.recursive === "on" ? "1" : "0");

  let scanResponse: Response;
  try {
    scanResponse = await fetch(scanUrl, {
      headers: { "x-rp-local-token": env.RP_LOCAL_MEDIA_TOKEN }
    });
  } catch {
    return jsonError("The Local file service is unavailable. Restart the application from Local.cmd.", 502);
  }

  const scan = await scanResponse.json().catch(() => ({})) as { ok?: boolean; files?: LocalFolderFile[]; error?: string };
  if (!scanResponse.ok || !scan.ok || !Array.isArray(scan.files)) {
    return jsonError(scan.error || "Could not scan the selected folder.", 400);
  }

  try {
    const targetFolder = normalizeRootPath(`${body.folder || "/root"}/${mountName}`);
    const items = await createLocalFolderItems(env, targetFolder, scan.files);
    return json({ ok: true, count: items.length, folder: targetFolder });
  } catch (error) {
    return jsonError("Folder mount failed.", 400, error instanceof Error ? error.message : error);
  }
};
