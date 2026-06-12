import type { AgentOutput, FetchResult } from "./types";

/** A single, human-readable line in a score's breakdown. */
export type ScoreLine = { label: string; points: number };
export type ScoreResult = { score: number; items: ScoreLine[] };
export type Breakdown = { pricing: ScoreLine[]; agent: ScoreLine[] };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const total = (items: ScoreLine[]) => items.reduce((sum, i) => sum + i.points, 0);

/**
 * Pricing clarity — how easy the pricing is to understand. 100 = crystal clear.
 *
 * Transparent points system: start at 100 and apply named deductions. Complexity
 * comes from how many decisions a buyer must make and how predictable the bill is.
 * Plain feature lists are NOT penalized — only structural complexity is.
 */
export function pricingScore(output: AgentOutput): ScoreResult {
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

  const items: ScoreLine[] = [{ label: "Base score", points: 100 }];

  const extraTiers = Math.max(0, tree.tiers.length - 1);
  if (extraTiers > 0) {
    items.push({
      label: `${tree.tiers.length} plans to compare`,
      points: -Math.min(30, extraTiers * 6),
    });
  }

  if (tree.billingModel === "usage" || tree.billingModel === "hybrid") {
    items.push({ label: "Usage-based billing (harder to predict)", points: -15 });
  }

  if (tree.addOns.length > 0) {
    items.push({
      label: `${tree.addOns.length} add-on${tree.addOns.length > 1 ? "s" : ""} / extras`,
      points: -Math.min(16, tree.addOns.length * 4),
    });
  }

  if (tree.hiddenCostSignals.length > 0) {
    items.push({
      label: `${tree.hiddenCostSignals.length} hidden-cost signal${tree.hiddenCostSignals.length > 1 ? "s" : ""}`,
      points: -Math.min(24, tree.hiddenCostSignals.length * 6),
    });
  }

  if (meta.requiresInteraction) {
    items.push({ label: "Real price needs a sales call / calculator", points: -10 });
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
