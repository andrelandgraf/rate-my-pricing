import type { FetchResult } from "./types";

const UA =
  "Mozilla/5.0 (compatible; RateMyPricingBot/1.0; +https://rate-my-pricing.vercel.app)";
const MAX_CHARS = 40_000;
const TIMEOUT_MS = 20_000;

async function timedFetch(url: string, headers: Record<string, string>): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "user-agent": UA, ...headers },
      redirect: "follow",
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
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

/**
 * Try hard to get readable content for a pricing page.
 * Strategy: prefer markdown (Accept header, then `.md` suffix), fall back to HTML-as-text.
 */
export async function fetchPricingContent(normalizedUrl: string): Promise<FetchResult> {
  const u = new URL(normalizedUrl);

  // 1. Ask for markdown directly.
  const mdRes = await timedFetch(normalizedUrl, { accept: "text/markdown, text/x-markdown" });
  if (mdRes?.ok) {
    const ct = mdRes.headers.get("content-type") ?? "";
    const body = await mdRes.text();
    if (/markdown/i.test(ct) && !looksLikeHtml(body)) {
      return clamp({ ok: true, status: mdRes.status, source: "markdown", content: body, finalUrl: mdRes.url });
    }
    // Keep the HTML body around as a fallback so we don't refetch.
    if (looksLikeHtml(body)) {
      return clamp({ ok: true, status: mdRes.status, source: "html", content: htmlToText(body), finalUrl: mdRes.url });
    }
    return clamp({ ok: true, status: mdRes.status, source: "markdown", content: body, finalUrl: mdRes.url });
  }

  // 2. Try the `.md` convention (works for many docs-style sites).
  if (!u.pathname.endsWith(".md")) {
    const mdUrl = new URL(normalizedUrl);
    mdUrl.pathname = `${mdUrl.pathname.replace(/\/$/, "")}.md`;
    const altRes = await timedFetch(mdUrl.toString(), { accept: "text/markdown" });
    if (altRes?.ok) {
      const body = await altRes.text();
      if (!looksLikeHtml(body)) {
        return clamp({ ok: true, status: altRes.status, source: "markdown", content: body, finalUrl: altRes.url });
      }
    }
  }

  // 3. Plain HTML, stripped to text.
  const htmlRes = await timedFetch(normalizedUrl, {
    accept: "text/html,application/xhtml+xml",
  });
  if (htmlRes?.ok) {
    const body = await htmlRes.text();
    return clamp({ ok: true, status: htmlRes.status, source: "html", content: htmlToText(body), finalUrl: htmlRes.url });
  }

  return {
    ok: false,
    status: htmlRes?.status ?? 0,
    source: "none",
    content: "",
    finalUrl: normalizedUrl,
  };
}

function clamp(result: FetchResult): FetchResult {
  if (result.content.length > MAX_CHARS) {
    return { ...result, content: result.content.slice(0, MAX_CHARS) };
  }
  return result;
}
