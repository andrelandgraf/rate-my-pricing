import { resolvePricingContent } from "./discover";
import { extract, analyze, buildOutput, MODEL } from "./parse";
import { categorize } from "./categorize";
import { pricingScore, agentScore, concretePriceCount, extractionPriceCount } from "./score";
import { firecrawlEnabled, firecrawlMarkdown } from "./firecrawl";
import { normalizeUrl, slugFromUrl, hostFromUrl, prettyHostName } from "./slug";
import type { FetchResult } from "./types";

// Cap rendered markdown to the same window as the cheap fetch.
const RENDER_MAX_CHARS = 100_000;

// Reject generic page headings sometimes returned as a product name.
const GENERIC_TITLE =
  /^\s*(pricing|plans?|pricing\s*(&|and|\+)?\s*plans?|plans?\s*(&|and)\s*pricing|our\s+pricing|pricing\s+page|subscriptions?|packages?|pricing\s+plans?|unknown)\s*$/i;

/** First non-empty, non-generic candidate name; otherwise a prettified host. */
function deriveTitle(candidates: (string | undefined)[], host: string): string {
  for (const c of candidates) {
    const name = (c ?? "").trim();
    if (name && !GENERIC_TITLE.test(name)) return name;
  }
  return prettyHostName(host);
}
import type { NewRatingRow } from "../db/schema";

export type GeneratedRating = Omit<NewRatingRow, "id" | "createdAt" | "updatedAt" | "views">;

/** Run the full agent pipeline for a URL and return a row ready to persist. */
export async function generateRating(
  rawUrl: string,
): Promise<{ slug: string; row: GeneratedRating; fetchStatus: number }> {
  const submitted = normalizeUrl(rawUrl);

  // Resolve the best pricing page (markdown-first; discover via llms.txt / sitemap / homepage
  // links / explorer agent when the submitted URL isn't itself a pricing page).
  const resolution = await resolvePricingContent(submitted);
  const url = resolution.url;
  // What an agent gets by curling the page directly — this drives AGENT EASINESS.
  const cheapFetched = resolution.fetched;
  if (!cheapFetched.ok) {
    // Expected outcome (unreachable/blocked/no-such-page) — a target-page issue, not an app
    // error, so just log it; don't report to Sentry.
    console.warn(`[agent] could not fetch ${url} (status ${cheapFetched.status})`);
  }
  const host = hostFromUrl(url);

  // Categorize (full-page context → company name + category) and extract the pricing structure
  // in parallel — they're independent, so this adds no latency over extraction alone.
  const [cat, cheapExtraction] = await Promise.all([
    categorize({ host, content: cheapFetched.content }),
    extract(cheapFetched, url),
  ]);

  // Completeness: when the cheap read looks partial (truncated or too few real prices — a classic
  // JS-rendered page), render the page FULLY with Firecrawl and re-extract. PRICING CLARITY is
  // scored on the most complete extraction (so a half-read page can't look falsely "simple").
  // AGENT EASINESS stays based on the cheap read — a page only legible after a full render is a
  // poor agent experience and should be marked down, not rescued.
  let bestExtraction = cheapExtraction;
  let pricingFetched = cheapFetched;
  if (firecrawlEnabled() && (cheapFetched.truncated || extractionPriceCount(cheapExtraction) < 3)) {
    const md = await firecrawlMarkdown(url);
    if (md) {
      const truncated = md.length > RENDER_MAX_CHARS;
      const rendered: FetchResult = {
        ok: true,
        status: 200,
        source: "markdown",
        content: truncated ? md.slice(0, RENDER_MAX_CHARS) : md,
        finalUrl: url,
        truncated,
      };
      const reExtracted = await extract(rendered, url);
      if (extractionPriceCount(reExtracted) > extractionPriceCount(cheapExtraction)) {
        bestExtraction = reExtracted;
        pricingFetched = rendered;
        console.log(`[agent] firecrawl render improved extraction for ${url}`);
      }
    }
  }

  const slug = slugFromUrl(url);
  const title = deriveTitle([cat.companyName, bestExtraction.productName], host);
  const category = cat.category;

  const analysis = await analyze(bestExtraction, category);
  // Complete picture → drives pricing clarity & what we display/store.
  const output = buildOutput(bestExtraction, analysis, title);
  // What the agent actually read by curling → drives agent easiness only.
  const cheapOutput = buildOutput(cheapExtraction, analysis, title);

  const pricing = pricingScore(output, category, pricingFetched);
  const agent = agentScore(cheapFetched, cheapOutput);

  // Only list entries where we actually mapped genuine prices (not marketing blurbs).
  const hasPrices = concretePriceCount(output) > 0;
  const listed = output.meta.foundPricing && hasPrices;
  const parseNotes = !output.meta.foundPricing
    ? "No concrete pricing was found on the page."
    : !hasPrices
      ? "The agent couldn't read this page's real pricing (it may be rendered client-side)."
      : "";

  return {
    slug,
    fetchStatus: cheapFetched.status,
    row: {
      slug,
      host,
      url,
      title,
      category,
      summary: output.tree.notes,
      pricingScore: pricing.score,
      agentScore: agent.score,
      tree: output.tree,
      breakdown: { pricing: pricing.items, agent: agent.items },
      rawExtraction: output.raw,
      // Reflects the agent's own read (markdown/html) — the experience, not the Firecrawl rescue.
      source: cheapFetched.source,
      model: MODEL,
      fetchOk: cheapFetched.ok,
      listed,
      parseNotes,
    },
  };
}
