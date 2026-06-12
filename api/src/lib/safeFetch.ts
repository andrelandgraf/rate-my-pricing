import dns from "node:dns/promises";
import net from "node:net";

/** Thrown when a URL targets a private/internal/disallowed host (SSRF guard). */
export class UnsafeUrlError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "UnsafeUrlError";
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  const mapped = lower.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped?.[1]) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // unknown format → treat as unsafe
}

/**
 * Validate that a URL is safe to fetch server-side.
 * Rejects non-http(s) schemes, blocked hostnames, IP literals in private ranges,
 * and hostnames that resolve to private/internal addresses (SSRF protection).
 */
export async function assertSafeUrl(raw: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UnsafeUrlError("invalid url");
  }

  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new UnsafeUrlError("unsupported scheme");
  }

  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  ) {
    throw new UnsafeUrlError("blocked host");
  }

  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new UnsafeUrlError("private ip literal");
    return;
  }

  let resolved: { address: string }[];
  try {
    resolved = await dns.lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError("dns resolution failed");
  }
  if (resolved.length === 0) throw new UnsafeUrlError("no dns records");
  for (const { address } of resolved) {
    if (isPrivateIp(address)) throw new UnsafeUrlError("resolves to private ip");
  }
}

/**
 * fetch() with SSRF protection. Validates the target (and every redirect hop)
 * against {@link assertSafeUrl} before connecting. Returns null on network error
 * or timeout. Throws UnsafeUrlError if any hop is disallowed.
 */
export async function safeFetch(
  startUrl: string,
  headers: Record<string, string>,
  timeoutMs: number,
  maxRedirects = 5,
): Promise<Response | null> {
  let current = startUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertSafeUrl(current);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(current, {
        headers,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  return null; // too many redirects
}
