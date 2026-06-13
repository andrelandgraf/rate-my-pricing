import { resolvePricingContent, deeperPricingCandidates } from "./discover";
import { fetchPricingContent } from "./fetch";
import { extract, analyze, buildOutput, MODEL } from "./parse";
import { categorize } from "./categorize";
import { pricingScore, agentScore, concretePriceCount, extractionPriceCount } from "./score";
import { firecrawlEnabled, firecrawlMarkdown } from "./firecrawl";
import { judgeRating } from "./judge";
import { Sentry } from "../instrument";
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
  // True when the real rates weren't on the landed pricing page — we had to dig deeper. Drives an
  // AGENT-EASINESS penalty (a self-contained pricing page is a better agent experience).
  let scattered = false;

  // Fetch a URL markdown-first, then render with Firecrawl if that read looks thin; return the
  // richer extraction.
  const readBest = async (target: string): Promise<{ extraction: typeof cheapExtraction; fetched: FetchResult }> => {
    const f = await fetchPricingContent(target);
    let e = await extract(f, target);
    let chosen = f;
    if (firecrawlEnabled() && (f.truncated || extractionPriceCount(e) < 3)) {
      const md = await firecrawlMarkdown(target);
      if (md) {
        const truncated = md.length > RENDER_MAX_CHARS;
        const rendered: FetchResult = {
          ok: true, status: 200, source: "markdown",
          content: truncated ? md.slice(0, RENDER_MAX_CHARS) : md, finalUrl: target, truncated,
        };
        const e2 = await extract(rendered, target);
        if (extractionPriceCount(e2) > extractionPriceCount(e)) {
          e = e2;
          chosen = rendered;
        }
      }
    }
    return { extraction: e, fetched: chosen };
  };

  // 1. Render the landed pricing page fully if the cheap read looks partial.
  if (firecrawlEnabled() && (cheapFetched.truncated || extractionPriceCount(cheapExtraction) < 3)) {
    const md = await firecrawlMarkdown(url);
    if (md) {
      const truncated = md.length > RENDER_MAX_CHARS;
      const rendered: FetchResult = {
        ok: true, status: 200, source: "markdown",
        content: truncated ? md.slice(0, RENDER_MAX_CHARS) : md, finalUrl: url, truncated,
      };
      const reExtracted = await extract(rendered, url);
      if (extractionPriceCount(reExtracted) > extractionPriceCount(cheapExtraction)) {
        bestExtraction = reExtracted;
        pricingFetched = rendered;
      }
    }
  }

  // 2. Only if the pricing page yielded NO prices at all (a pure shell that links out to the real
  //    rates) do we follow deeper — and only to candidates that are genuinely pricing pages, never
  //    blogs. If the page has any real prices, we stop there (don't wander off to other pages).
  if (extractionPriceCount(bestExtraction) === 0) {
    const candidates = deeperPricingCandidates(pricingFetched.content || cheapFetched.content, url);
    for (const candidate of candidates.slice(0, 3)) {
      const { extraction: e, fetched: f } = await readBest(candidate);
      if (extractionPriceCount(e) > extractionPriceCount(bestExtraction)) {
        bestExtraction = e;
        pricingFetched = f;
        scattered = true;
        if (extractionPriceCount(e) >= 5) break;
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
  const agent = agentScore(cheapFetched, cheapOutput, { scattered });

  // Only list entries where we actually mapped genuine prices (not marketing blurbs).
  const hasPrices = concretePriceCount(output) > 0;
  let listed = output.meta.foundPricing && hasPrices;
  let parseNotes = !output.meta.foundPricing
    ? "No concrete pricing was found on the page."
    : !hasPrices
      ? "The agent couldn't read this page's real pricing (it may be rendered client-side)."
      : "";

  // QA judge gate — catch regressions (wrong page/company, missing details, inconsistencies)
  // before publishing. A clear FAIL unlists + flags; a WARN is logged for observability.
  const verdict = await judgeRating({
    submittedUrl: submitted,
    resolvedUrl: url,
    title,
    category,
    tree: output.tree,
    meters: bestExtraction.usageDimensions.filter((d) => d.price?.trim()).length,
    pricingScore: pricing.score,
    agentScore: agent.score,
    listed,
    source: cheapFetched.source,
    content: pricingFetched.content,
  });
  if (verdict.verdict === "fail") {
    listed = false;
    parseNotes = `Flagged in review: ${verdict.issues.join("; ")}`.slice(0, 280) || parseNotes;
    Sentry.captureMessage(`[judge] FAIL ${url}`, {
      level: "warning",
      tags: { component: "judge" },
      extra: { submitted, url, issues: verdict.issues },
    });
  } else if (verdict.verdict === "warn" && verdict.issues.length) {
    Sentry.captureMessage(`[judge] WARN ${url}`, {
      level: "info",
      tags: { component: "judge" },
      extra: { url, issues: verdict.issues },
    });
  }

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
