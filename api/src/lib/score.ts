import type { AgentOutput, FetchResult, Category } from "./types";

/** A single, human-readable line in a score's breakdown. */
export type ScoreLine = { label: string; points: number };
export type ScoreResult = { score: number; items: ScoreLine[] };
export type Breakdown = { pricing: ScoreLine[]; agent: ScoreLine[] };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const total = (items: ScoreLine[]) => items.reduce((sum, i) => sum + i.points, 0);

/**
 * Per-category weights on the SAME five clarity signals. 1.0 = baseline penalty.
 *
 * The guiding principle: judge each signal against what's NORMAL for the category.
 * Usage/metered billing is unavoidable & expected for devtools and AI labs, so it barely
 * dents clarity there; it's unusual (and so a real clarity problem) for SaaS, and a red
 * flag for educational products that should be flat/one-time.
 */
type PricingWeights = {
  tiers: number;
  usage: number;
  addOns: number;
  hiddenCosts: number;
  interaction: number;
};

const CATEGORY_WEIGHTS: Record<Category, PricingWeights> = {
  devtools: { tiers: 1.0, usage: 0.5, addOns: 0.8, hiddenCosts: 0.6, interaction: 0.8 },
  "ai-labs": { tiers: 0.9, usage: 0.4, addOns: 0.9, hiddenCosts: 0.5, interaction: 0.8 },
  clouds: { tiers: 1.0, usage: 0.8, addOns: 1.0, hiddenCosts: 1.0, interaction: 0.9 },
  saas: { tiers: 1.0, usage: 1.3, addOns: 1.0, hiddenCosts: 1.2, interaction: 1.1 },
  educational: { tiers: 1.0, usage: 1.6, addOns: 1.1, hiddenCosts: 1.4, interaction: 1.2 },
  other: { tiers: 1.0, usage: 1.0, addOns: 1.0, hiddenCosts: 1.0, interaction: 1.0 },
};

const CATEGORY_NOUN: Record<Category, string> = {
  devtools: "dev tools",
  "ai-labs": "AI labs",
  clouds: "clouds",
  saas: "SaaS",
  educational: "courses",
  other: "this category",
};

/**
 * Pricing clarity — how easy the pricing is to understand. 100 = crystal clear.
 *
 * Transparent points system: start at 100 and apply named deductions. The deductions use the
 * same base magnitudes everywhere, scaled by a per-category weight so that "expected" complexity
 * (e.g. usage billing for a dev tool) is judged more gently than the same trait somewhere it
 * doesn't belong (e.g. usage billing on a course). Plain feature lists are never penalized.
 */
export function pricingScore(output: AgentOutput, category: Category = "other"): ScoreResult {
  const { tree, meta } = output;

  if (!meta.foundPricing) {
    return {
      score: 10,
      items: [
        { label: "Base score", points: 100 },
        { label: "No public pricing shown on the page", points: -90 },
      ],
    };
  }

  const w = CATEGORY_WEIGHTS[category] ?? CATEGORY_WEIGHTS.other;
  const noun = CATEGORY_NOUN[category] ?? CATEGORY_NOUN.other;
  const deduct = (base: number, weight: number) => -Math.round(base * weight);

  const items: ScoreLine[] = [{ label: "Base score", points: 100 }];

  const extraTiers = Math.max(0, tree.tiers.length - 1);
  if (extraTiers > 0) {
    items.push({
      label: `${tree.tiers.length} plans to compare`,
      points: deduct(Math.min(30, extraTiers * 6), w.tiers),
    });
  }

  if (tree.billingModel === "usage" || tree.billingModel === "hybrid") {
    const usageLabel =
      w.usage <= 0.7
        ? `Usage-based billing (normal for ${noun})`
        : w.usage >= 1.1
          ? `Usage-based billing (unusual for ${noun} — hard to predict)`
          : "Usage-based billing (harder to predict)";
    items.push({ label: usageLabel, points: deduct(15, w.usage) });
  }

  if (tree.addOns.length > 0) {
    items.push({
      label: `${tree.addOns.length} add-on${tree.addOns.length > 1 ? "s" : ""} / extras`,
      points: deduct(Math.min(16, tree.addOns.length * 4), w.addOns),
    });
  }

  if (tree.hiddenCostSignals.length > 0) {
    items.push({
      label: `${tree.hiddenCostSignals.length} hidden-cost signal${tree.hiddenCostSignals.length > 1 ? "s" : ""}`,
      points: deduct(Math.min(24, tree.hiddenCostSignals.length * 6), w.hiddenCosts),
    });
  }

  if (meta.requiresInteraction) {
    items.push({
      label: "Real price needs a sales call / calculator",
      points: deduct(10, w.interaction),
    });
  }

  return { score: clamp(total(items)), items };
}

/**
 * Agent easiness — how easy it was for the agent to read the page. 100 = effortless.
 *
 * Scored purely from concrete, observable signals (no opaque confidence number):
 * could we fetch it, was it clean markdown or messy HTML, did we find real pricing,
 * and was the price gated behind interaction.
 */
export function agentScore(fetched: FetchResult, output: AgentOutput): ScoreResult {
  if (!fetched.ok || fetched.source === "none") {
    return {
      score: 0,
      items: [
        { label: "Base score", points: 100 },
        { label: "Couldn't fetch the page at all", points: -100 },
      ],
    };
  }

  const items: ScoreLine[] = [{ label: "Base score", points: 100 }];

  if (fetched.source === "html") {
    items.push({ label: "Read from raw HTML (no markdown)", points: -15 });
  }

  if (!output.meta.foundPricing) {
    items.push({ label: "No concrete pricing to parse", points: -40 });
  }

  if (output.meta.requiresInteraction) {
    items.push({ label: "Pricing gated behind interaction", points: -20 });
  }

  return { score: clamp(total(items)), items };
}
