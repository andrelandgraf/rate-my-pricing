// Firecrawl render tier — used to get the FULL, JS-rendered pricing content when our cheap
// fetch looks incomplete (truncated or too few real prices). One HTTP call; gated on an API key
// so local/unconfigured branches just skip it.
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";
const TIMEOUT_MS = 60_000;

export function firecrawlEnabled(): boolean {
  return !!process.env.FIRECRAWL_API_KEY;
}

/** Fully render a URL and return clean markdown (JS executed), or null on failure/disabled. */
export async function firecrawlMarkdown(url: string): Promise<string | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(FIRECRAWL_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[firecrawl] ${url} -> ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { success?: boolean; data?: { markdown?: string } };
    const md = data?.data?.markdown;
    return md && md.trim().length > 0 ? md : null;
  } catch (err) {
    console.warn(`[firecrawl] ${url} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}
