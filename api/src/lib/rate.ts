import { fetchPricingContent } from "./fetch";
import { extract, analyze, buildOutput, extractionFacts, MODEL } from "./parse";
import { categorize } from "./categorize";
import { pricingScore, agentScore } from "./score";
import { normalizeUrl, slugFromUrl, hostFromUrl, isBareHostUrl, prettyHostName } from "./slug";

// Reject generic page headings the parser sometimes returns as a product name.
const GENERIC_TITLE =
  /^\s*(pricing|plans?|pricing\s*(&|and|\+)?\s*plans?|plans?\s*(&|and)\s*pricing|our\s+pricing|pricing\s+page|subscriptions?|packages?|pricing\s+plans?)\s*$/i;

function deriveTitle(productName: string | undefined, host: string): string {
  const name = (productName ?? "").trim();
  if (!name || name === "Unknown" || GENERIC_TITLE.test(name)) return prettyHostName(host);
  return name;
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

  // Step 1 — extract the clean, injection-free pricing facts.
  let extraction = await extract(fetched, url);

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
  const host = hostFromUrl(url);
  const title = deriveTitle(extraction.productName, host);

  // Categorize from the clean facts, THEN analyze + score with category context.
  const category = await categorize({ title, host, facts: extractionFacts(extraction) });
  const analysis = await analyze(extraction, category);
  const output = buildOutput(extraction, analysis);

  const pricing = pricingScore(output, category);
  const agent = agentScore(fetched, output);

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
      listed: output.meta.foundPricing,
      parseNotes: output.meta.foundPricing
        ? ""
        : "No concrete pricing was found on the page.",
    },
  };
}
