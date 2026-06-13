import { fetchPricingContent } from "./fetch";
import { parsePricing, MODEL } from "./parse";
import { categorize } from "./categorize";
import { pricingScore, agentScore } from "./score";
import { normalizeUrl, slugFromUrl, hostFromUrl, isBareHostUrl } from "./slug";
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
  let output = await parsePricing(fetched, url);

  // If a bare host has no pricing on its homepage, try the conventional /pricing path.
  if (!output.meta.foundPricing && isBareHostUrl(url)) {
    const pricingUrl = `${new URL(url).origin}/pricing`;
    const f2 = await fetchPricingContent(pricingUrl);
    if (f2.ok) {
      const o2 = await parsePricing(f2, pricingUrl);
      if (o2.meta.foundPricing) {
        url = pricingUrl;
        fetched = f2;
        output = o2;
      }
    }
  }

  const slug = slugFromUrl(url);
  const host = hostFromUrl(url);

  const pricing = pricingScore(output);
  const agent = agentScore(fetched, output);

  const title =
    output.tree.productName && output.tree.productName !== "Unknown"
      ? output.tree.productName
      : host;

  const category = await categorize({ title, host, summary: output.tree.notes });

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
