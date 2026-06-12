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
