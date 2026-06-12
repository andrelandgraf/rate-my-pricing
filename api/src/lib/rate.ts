import { fetchPricingContent } from "./fetch";
import { parsePricing, MODEL } from "./parse";
import { pricingScore, agentScore } from "./score";
import { normalizeUrl, slugFromUrl } from "./slug";
import { Sentry } from "../instrument";
import type { NewRatingRow } from "../db/schema";

export type GeneratedRating = Omit<NewRatingRow, "id" | "createdAt" | "updatedAt" | "views">;

/** Run the full agent pipeline for a URL and return a row ready to persist. */
export async function generateRating(rawUrl: string): Promise<{ slug: string; row: GeneratedRating }> {
  const url = normalizeUrl(rawUrl);
  const slug = slugFromUrl(url);

  const fetched = await fetchPricingContent(url);
  if (!fetched.ok) {
    Sentry.captureMessage(`agent could not fetch pricing page: ${url}`, {
      level: "warning",
      tags: { component: "agent", phase: "fetch" },
      extra: { url, status: fetched.status },
    });
  }
  const output = await parsePricing(fetched, url);

  const pricing = pricingScore(output);
  const agent = agentScore(fetched, output);

  const title =
    output.tree.productName && output.tree.productName !== "Unknown"
      ? output.tree.productName
      : new URL(url).hostname;

  return {
    slug,
    row: {
      slug,
      url,
      title,
      summary: output.tree.notes,
      pricingScore: pricing.score,
      agentScore: agent.score,
      tree: output.tree,
      breakdown: { pricing: pricing.items, agent: agent.items },
      source: fetched.source,
      model: MODEL,
      fetchOk: fetched.ok,
      parseNotes: output.meta.foundPricing
        ? ""
        : "No concrete pricing was found on the page.",
    },
  };
}
