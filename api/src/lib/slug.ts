/** Normalize a user-submitted URL into an absolute, canonical https URL. */
export function normalizeUrl(input: string): string {
  let raw = input.trim();
  if (!raw) throw new Error("empty url");
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  const u = new URL(raw);
  u.hash = "";
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  // drop trailing slash on the path (but keep root "/")
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }
  // strip common tracking params
  const tracking = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "fbclid", "gclid"];
  for (const key of tracking) u.searchParams.delete(key);
  return u.toString();
}

/** The registrable host (lowercased, www-stripped) — the de-duplication key. */
export function hostFromUrl(normalized: string): string {
  return new URL(normalized).hostname.toLowerCase().replace(/^www\./, "");
}

const MULTIPART_TLDS = new Set([
  "co.uk", "com.au", "co.jp", "com.br", "co.in", "com.mx", "co.nz", "com.sg",
]);

/**
 * A human-friendly brand name derived from a host, used as a title fallback when the parser
 * couldn't find a real product/company name (e.g. it returned "Pricing"). Picks the registrable
 * label (e.g. cloud.google.com -> "Google", datadoghq.com -> "Datadoghq").
 */
export function prettyHostName(host: string): string {
  const clean = host.toLowerCase().replace(/^www\./, "");
  const parts = clean.split(".");
  let main: string;
  if (parts.length >= 3 && MULTIPART_TLDS.has(parts.slice(-2).join("."))) {
    main = parts[parts.length - 3] ?? clean;
  } else if (parts.length >= 2) {
    main = parts[parts.length - 2] ?? clean;
  } else {
    main = clean;
  }
  return main.charAt(0).toUpperCase() + main.slice(1);
}

/** True when the URL is just a host with no meaningful path (e.g. https://hey.com/). */
export function isBareHostUrl(normalized: string): boolean {
  const { pathname } = new URL(normalized);
  return pathname === "" || pathname === "/";
}

/** Build a stable, human-readable, URL-safe slug from a normalized URL. */
export function slugFromUrl(normalized: string): string {
  const u = new URL(normalized);
  const host = u.hostname;
  const path = `${u.pathname}${u.search}`.replace(/^\//, "");
  const combined = path ? `${host}/${path}` : host;
  const slug = combined
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug.slice(0, 120);
}
