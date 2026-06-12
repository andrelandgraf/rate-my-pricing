import type { AgentOutput, FetchResult } from "./types";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Pricing complexity, expressed as an *easiness* score.
 * 100 = trivially simple to understand, 0 = byzantine.
 *
 * Complexity comes from the number of decisions a buyer must reason about — the
 * "levels and branches" of the pricing tree — and from how *predictable* the
 * final bill is. A long feature list is value, not complexity, so features are
 * deliberately not penalized; tiers, add-ons, metered dimensions, usage billing,
 * and sales-gating are.
 */
export function pricingScore(output: AgentOutput): number {
  const { tree, meta } = output;

  if (!meta.foundPricing) {
    // No concrete pricing surfaced (e.g. pure "contact sales"). Opaque by definition.
    return clamp(22 - tree.hiddenCostSignals.length * 4);
  }

  let score = 100;

  // Levels: each tier beyond the first is another plan to compare.
  const extraTiers = Math.max(0, tree.tiers.length - 1);
  score -= Math.min(22, extraTiers * 5);

  // Branches: add-ons / additional packages multiply the decision space.
  score -= Math.min(15, tree.addOns.length * 3);

  // Metered dimensions (limits/quotas you have to track) make the bill harder to predict.
  const dimensions = tree.tiers.reduce((sum, t) => sum + t.limits.length, 0);
  score -= Math.min(12, dimensions * 0.4);

  // Hidden / variable cost signals are the strongest complexity driver.
  score -= Math.min(21, tree.hiddenCostSignals.length * 3);

  // Usage / hybrid billing is inherently harder to predict than flat or per-seat.
  if (tree.billingModel === "usage" || tree.billingModel === "hybrid") score -= 12;

  // Pricing you can't actually see without talking to sales.
  if (meta.requiresInteraction) score -= 8;

  return clamp(score);
}

/**
 * Agent easiness: how easy was it for the agent to fetch + parse this page?
 * 100 = clean source, fully parsed, high confidence. 0 = couldn't get anything useful.
 */
export function agentScore(fetched: FetchResult, output: AgentOutput): number {
  if (!fetched.ok || fetched.source === "none") return 0;

  // Confidence is the backbone of the score.
  let score = output.meta.parseConfidence * 100;

  // Clean markdown is the happy path; raw HTML soup is harder and noisier.
  if (fetched.source === "html") score -= 12;

  // If pricing is gated behind interaction, the agent did its best but was blocked.
  if (output.meta.requiresInteraction) score -= 16;
  if (!output.meta.foundPricing) score -= 25;

  // Small reward for at least successfully retrieving the page.
  score += 6;

  return clamp(score);
}
