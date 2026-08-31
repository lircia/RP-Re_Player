export const VISITOR_BASE_PATH = "/Local";
export const VISITOR_MOUNT_PATH = `${VISITOR_BASE_PATH}/Pash`;
export const VISITOR_TREE_PATH = `${VISITOR_BASE_PATH}/tree`;

export function visitorUrl(path: string) {
  const relative = String(path || "/root")
    .replace(/^\/root(?=\/|$)/, "")
    .replace(/^\/+|\/+$/g, "");
  if (!relative) return VISITOR_BASE_PATH;
  if (relative === "tree" || relative.startsWith("tree/")) {
    const treeRelative = relative.slice("tree".length).replace(/^\/+/, "");
    return treeRelative
      ? `${VISITOR_TREE_PATH}/${treeRelative.split("/").map((part) => encodeURIComponent(part)).join("/")}`
      : VISITOR_TREE_PATH;
  }
  return `${VISITOR_MOUNT_PATH}/${relative.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

export function pseudoPathFromVisitorUrl(pathname: string) {
  if (pathname === VISITOR_BASE_PATH || pathname === `${VISITOR_BASE_PATH}/`) return "/root";
  if (pathname === VISITOR_MOUNT_PATH || pathname === `${VISITOR_MOUNT_PATH}/`) return "/root";
  if (pathname === VISITOR_TREE_PATH || pathname === `${VISITOR_TREE_PATH}/`) return "/root/tree";
  if (pathname.startsWith(`${VISITOR_TREE_PATH}/`)) {
    const relative = pathname.slice(VISITOR_TREE_PATH.length + 1).replace(/\/$/, "");
    const encodedParts = relative.split("/");
    if (encodedParts.some((part) => !part)) return null;
    try {
      const parts = encodedParts.map((part) => decodeURIComponent(part));
      if (parts.some((part) => !part || part === "." || part === ".." || /[\\/\u0000-\u001f\u007f]/.test(part))) return null;
      return `/root/tree/${parts.join("/")}`;
    } catch {
      return null;
    }
  }
  if (!pathname.startsWith(`${VISITOR_MOUNT_PATH}/`)) return null;

  const relative = pathname.slice(VISITOR_MOUNT_PATH.length + 1).replace(/\/$/, "");
  if (!relative) return "/root";
  const encodedParts = relative.split("/");
  if (encodedParts.some((part) => !part)) return null;
  try {
    const parts = encodedParts.map((part) => decodeURIComponent(part));
    if (parts.some((part) =>
      !part || part === "." || part === ".." || /[\\/\u0000-\u001f\u007f]/.test(part)
    )) return null;
    return `/root/${parts.join("/")}`;
  } catch {
    return null;
  }
}

export function parentPseudoPath(path: string) {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.length > 1 ? `/${parts.join("/")}` : "/root";
}
