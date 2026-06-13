import type { FetchResult } from "./types";
import { safeFetch, UnsafeUrlError } from "./safeFetch";

const UA =
  "Mozilla/5.0 (compatible; RateMyPricingBot/1.0; +https://rate-my-pricing.vercel.app)";
const MAX_CHARS = 100_000;
const TIMEOUT_MS = 20_000;

async function timedFetch(url: string, headers: Record<string, string>): Promise<Response | null> {
  try {
    return await safeFetch(url, { "user-agent": UA, ...headers }, TIMEOUT_MS);
  } catch (err) {
    // A redirect into a private/internal host (SSRF) is treated as an unfetchable page.
    if (err instanceof UnsafeUrlError) return null;
    return null;
  }
}

function looksLikeHtml(text: string): boolean {
  const head = text.slice(0, 500).toLowerCase();
  return head.includes("<!doctype html") || head.includes("<html") || /<\/?(div|body|head|script)\b/.test(head);
}

/** Strip an HTML document down to readable text content. */
export function htmlToText(html: string): string {
  let text = html;
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(/<(script|style|noscript|svg|head)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  text = text.replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  text = text.replace(/[ \t\f\v]+/g, " ").replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

/** Raw fetch (no stripping) for a URL — used by the discovery step for llms.txt/sitemap/anchors. */
export async function fetchRaw(
  url: string,
  accept = "text/html,application/xhtml+xml,text/plain",
): Promise<string | null> {
  const res = await timedFetch(url, { accept });
  if (!res?.ok) return null;
  try {
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Try hard to get readable content for a pricing page.
 * Strategy: prefer markdown — (1) content negotiation, then (2) the `.md` convention even if the
 * server ignored Accept and returned HTML — and only (3) fall back to HTML-as-text last.
 */
export async function fetchPricingContent(normalizedUrl: string): Promise<FetchResult> {
  const u = new URL(normalizedUrl);
  let htmlFallback: FetchResult | null = null;

  // 1. Ask for markdown directly.
  const mdRes = await timedFetch(normalizedUrl, { accept: "text/markdown, text/x-markdown" });
  if (mdRes?.ok) {
    const ct = mdRes.headers.get("content-type") ?? "";
    const body = await mdRes.text();
    if (!looksLikeHtml(body) && (/markdown|text\/plain/i.test(ct) || body.trim())) {
      return clamp({ ok: true, status: mdRes.status, source: "markdown", content: body, finalUrl: mdRes.url });
    }
    // Server ignored Accept and returned HTML — keep it as a fallback, but still try `.md` next.
    if (looksLikeHtml(body)) {
      htmlFallback = clamp({
        ok: true,
        status: mdRes.status,
        source: "html",
        content: htmlToText(body),
        finalUrl: mdRes.url,
      });
    }
  }

  // 2. Try the `.md` convention (works for many docs/markdown-first sites, e.g. /pricing.md).
  if (!u.pathname.endsWith(".md")) {
    const mdUrl = new URL(normalizedUrl);
    mdUrl.pathname = `${mdUrl.pathname.replace(/\/$/, "")}.md`;
    const altRes = await timedFetch(mdUrl.toString(), { accept: "text/markdown" });
    if (altRes?.ok) {
      const body = await altRes.text();
      if (!looksLikeHtml(body) && body.trim()) {
        return clamp({ ok: true, status: altRes.status, source: "markdown", content: body, finalUrl: altRes.url });
      }
    }
  }

  // 3. HTML fallback (from step 1 if we have it, else fetch fresh).
  if (htmlFallback) return htmlFallback;
  const htmlRes = await timedFetch(normalizedUrl, { accept: "text/html,application/xhtml+xml" });
  if (htmlRes?.ok) {
    const body = await htmlRes.text();
    return clamp({ ok: true, status: htmlRes.status, source: "html", content: htmlToText(body), finalUrl: htmlRes.url });
  }

  return {
    ok: false,
    status: htmlRes?.status ?? mdRes?.status ?? 0,
    source: "none",
    content: "",
    finalUrl: normalizedUrl,
    truncated: false,
  };
}

// Defense-in-depth against prompt/output injection: neutralize text that mimics OUR output
// schema (a page can embed a ready-made "answer" hoping the model copies it) or tries to
// address/instruct the rating agent. The model is also hardened, and the analyst never sees raw
// content — this just removes the obvious copy-paste bait.
const INJECTION_TOKENS =
  /"(hiddenCostSignals|foundPricing|requiresInteraction|billingModel|pricingScore|agentScore)"\s*:/gi;
const INJECTION_DIRECTIVES =
  /\b(ignore (all |the )?(previous|above) instructions|rating agent|you (must|should) (rate|score)|system prompt)\b/gi;

function sanitize(content: string): string {
  return content
    .replace(INJECTION_TOKENS, '"_redacted_":')
    .replace(INJECTION_DIRECTIVES, "[removed]");
}

function clamp(result: Omit<FetchResult, "truncated">): FetchResult {
  const content = sanitize(result.content);
  const truncated = content.length > MAX_CHARS;
  return { ...result, truncated, content: truncated ? content.slice(0, MAX_CHARS) : content };
}
