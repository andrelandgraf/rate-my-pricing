import { fetchPricingContent } from "./fetch";
import { extract, analyze, buildOutput, MODEL } from "./parse";
import { categorize } from "./categorize";
import { pricingScore, agentScore } from "./score";
import { normalizeUrl, slugFromUrl, hostFromUrl, isBareHostUrl, prettyHostName } from "./slug";

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
export async function generateRating(rawUrl: string): Promise<{ slug: string; row: GeneratedRating }> {
  let url = normalizeUrl(rawUrl);

  let fetched = await fetchPricingContent(url);
  if (!fetched.ok) {
    // Expected outcome (unreachable/blocked/no-such-page) — a target-page issue, not an app
    // error, so just log it; don't report to Sentry.
    console.warn(`[agent] could not fetch ${url} (status ${fetched.status})`);
  }
  const host = hostFromUrl(url);

  // Categorize (full-page context → company name + category) and extract the pricing structure
  // in parallel — they're independent, so this adds no latency over extraction alone.
  let [cat, extraction] = await Promise.all([
    categorize({ host, content: fetched.content }),
    extract(fetched, url),
  ]);

  // If a bare host has no pricing on its homepage, try the conventional /pricing path.
  if (!extraction.foundPricing && isBareHostUrl(url)) {
    const pricingUrl = `${new URL(url).origin}/pricing`;
    const f2 = await fetchPricingContent(pricingUrl);
    if (f2.ok) {
      const e2 = await extract(f2, pricingUrl);
      if (e2.foundPricing) {
        url = pricingUrl;
        fetched = f2;
        extraction = e2;
      }
    }
  }

  const slug = slugFromUrl(url);
  const title = deriveTitle([cat.companyName, extraction.productName], host);
  const category = cat.category;

  // Analyze + score from the CLEAN structure, with category context.
  const analysis = await analyze(extraction, category);
  const output = buildOutput(extraction, analysis, title);

  const pricing = pricingScore(output, category);
  const agent = agentScore(fetched, output);

  // Only list entries where we actually mapped a usable pricing structure.
  const usableStructure =
    extraction.tiers.length > 0 || extraction.usageDimensions.length > 0;
  const listed = output.meta.foundPricing && usableStructure;
  const parseNotes = !output.meta.foundPricing
    ? "No concrete pricing was found on the page."
    : !usableStructure
      ? "The agent couldn't read this page's real pricing (it may be rendered client-side)."
      : "";

  return {
    slug,
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
      source: fetched.source,
      model: MODEL,
      fetchOk: fetched.ok,
      listed,
      parseNotes,
    },
  };
}
