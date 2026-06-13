import type { AgentOutput, FetchResult, Category, Extraction } from "./types";

/** A single, human-readable line in a score's breakdown. */
export type ScoreLine = { label: string; points: number };
export type ScoreResult = { score: number; items: ScoreLine[] };
export type Breakdown = { pricing: ScoreLine[]; agent: ScoreLine[] };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const total = (items: ScoreLine[]) => items.reduce((sum, i) => sum + i.points, 0);

// Marketing/promo phrasing that is NOT a payable price (free credits, % discounts, "20+", trials).
const PROMO =
  /(%|free\s+credit|up\s*to\b|\bsave\b|discount|\btrial\b|\bcredits?\b|months?\s+free|^\s*\d+\s*\+\s*$)/i;

function isRealPrice(p?: string): boolean {
  const s = (p ?? "").trim();
  if (!s) return false;
  if (/^(custom|contact|contact\s+sales|talk|quote|call|n\/?a|—|-|tbd)$/i.test(s)) return false;
  if (PROMO.test(s)) return false;
  return /\d/.test(s) || /^free$/i.test(s);
}

/**
 * How many genuinely-priced PRIMARY items we mapped — real numeric/Free prices on plans, in-plan
 * options, or metered rates (NOT add-ons, which can't stand in for a pricing model on their own,
 * and excluding marketing blurbs). The core confidence signal: zero means we couldn't actually
 * read the pricing, which must NOT be rewarded as "simple".
 */
export function extractionPriceCount(e: Extraction): number {
  let n = 0;
  for (const t of e.tiers) {
    if (isRealPrice(t.price)) n++;
    for (const g of t.options ?? []) for (const c of g.choices) if (isRealPrice(c.price)) n++;
  }
  for (const d of e.usageDimensions) if (isRealPrice(d.price)) n++;
  return n;
}

export function concretePriceCount(output: AgentOutput): number {
  return extractionPriceCount(output.raw);
}

/**
 * Per-category weights. 1.0 = baseline penalty. Usage/metered billing is NOT penalized for merely
 * existing (it's value-aligned, pay-for-what-you-use) — we only score its *complexity* (how many
 * metered dimensions), lightly for everyone except education (which should be flat/one-time).
 */
type PricingWeights = {
  tiers: number;
  options: number;
  usage: number;
  addOns: number;
  interaction: number;
};

const CATEGORY_WEIGHTS: Record<Category, PricingWeights> = {
  devtools: { tiers: 1.0, options: 0.8, usage: 0.5, addOns: 0.9, interaction: 0.85 },
  paas: { tiers: 1.0, options: 0.7, usage: 0.5, addOns: 0.85, interaction: 0.8 },
  hyperscaler: { tiers: 1.0, options: 0.8, usage: 0.6, addOns: 0.9, interaction: 0.85 },
  "ai-lab": { tiers: 0.9, options: 0.7, usage: 0.4, addOns: 0.85, interaction: 0.8 },
  saas: { tiers: 1.0, options: 1.0, usage: 0.6, addOns: 1.0, interaction: 1.0 },
  educational: { tiers: 1.0, options: 1.1, usage: 1.5, addOns: 1.0, interaction: 1.1 },
  other: { tiers: 1.0, options: 1.0, usage: 1.0, addOns: 1.0, interaction: 1.0 },
};

// "Normal" baselines that exist on most clear pricing pages — only complexity BEYOND these counts.
const BASELINE = { plans: 3, options: 4, addOns: 2, meters: 3 };

const isFreePrice = (p?: string): boolean => /^(free|\$?0)$/i.test((p ?? "").trim());

const isPaidPrice = (p?: string): boolean => {
  const s = (p ?? "").trim();
  return isRealPrice(s) && !/^free$/i.test(s);
};

/** Gentle, capped penalty for navigating a broad catalog of distinct services. */
function breadthPenalty(services: number): number {
  if (services <= 1) return 0;
  if (services <= 3) return 2;
  if (services <= 7) return 4;
  if (services <= 15) return 7;
  if (services <= 30) return 10;
  return 13;
}

/**
 * Pricing clarity — how easy it is to predict what you'll pay, GIVEN the scope of what's offered.
 *
 * Transparent points system: start at 100 and apply named, count-derived deductions. Two scope-
 * aware adjustments make the comparison fair across a one-product startup and a broad platform:
 *  - a gentle breadth penalty for navigating many distinct services, and
 *  - a scope credit that forgives raw complexity in proportion to how much the platform offers
 *    (complexity is judged RELATIVE to scope — many simple services beats one knob-laden product).
 * Category weights still tune how "expected" each signal is. No opaque agent-assigned numbers.
 */
export function pricingScore(
  output: AgentOutput,
  category: Category = "other",
  fetched?: FetchResult,
): ScoreResult {
  const { tree, meta, raw } = output;

  if (!meta.foundPricing) {
    return {
      score: 10,
      items: [
        { label: "Base score", points: 100 },
        { label: "No public pricing shown on the page", points: -90 },
      ],
    };
  }

  // Confidence gate: if we couldn't pull any genuine prices (only marketing blurbs, or a
  // JS-rendered page), this isn't "simple" — we failed to read it. Never reward that.
  if (concretePriceCount(output) === 0) {
    return {
      score: 12,
      items: [
        { label: "Base score", points: 100 },
        { label: "Couldn't read any concrete prices on the page", points: -88 },
      ],
    };
  }

  const w = CATEGORY_WEIGHTS[category] ?? CATEGORY_WEIGHTS.other;
  const deduct = (base: number, weight: number) => -Math.round(base * weight);

  // We score COMPLEXITY BEYOND A BASELINE, not the mere existence of plans/usage/Enterprise. The
  // dominant negative is the sales wall (no self-serve price). Signals split into BREADTH-DRIVEN
  // (plans, options, add-ons — scale naturally with offering many products, so forgiven by scope)
  // vs INTRINSIC (metered density, sales gates, sprawl — never hand-waved away by scope).
  const complexity: ScoreLine[] = [];
  let breadthMagnitude = 0;
  const pushBreadth = (line: ScoreLine) => {
    complexity.push(line);
    breadthMagnitude += -line.points;
  };

  // Counts used across signals.
  const meters = raw.usageDimensions.filter((d) => isRealPrice(d.price)).length;
  const paidTiers = tree.tiers.filter((t) => isPaidPrice(t.price)).length;
  const hasFreeTier = tree.tiers.some((t) => isFreePrice(t.price));
  const optionChoices = tree.tiers.reduce(
    (sum, t) => sum + (t.options ?? []).reduce((s, g) => s + g.choices.length, 0),
    0,
  );

  // Plans beyond a normal handful (baseline 3). A free tier is a trivial yes/no branch, so it
  // eases comparison — softer penalty when one is present.
  const extraTiers = Math.max(0, tree.tiers.length - BASELINE.plans);
  if (extraTiers > 0) {
    const base = Math.min(24, extraTiers * 6) * (hasFreeTier ? 0.6 : 1);
    pushBreadth({ label: `${tree.tiers.length} plans to compare`, points: deduct(base, w.tiers) });
  }

  // Nested in-plan choices (machine sizes, regions, …) beyond a few.
  const extraOptions = Math.max(0, optionChoices - BASELINE.options);
  if (extraOptions > 0) {
    pushBreadth({
      label: `${optionChoices} in-plan configuration choices`,
      points: deduct(Math.min(20, extraOptions * 2), w.options),
    });
  }

  // Add-ons beyond a couple.
  const extraAddOns = Math.max(0, tree.addOns.length - BASELINE.addOns);
  if (extraAddOns > 0) {
    pushBreadth({
      label: `${tree.addOns.length} add-ons / extras`,
      points: deduct(Math.min(16, extraAddOns * 4), w.addOns),
    });
  }

  // Metered billing isn't penalized for existing — only the complexity of MANY metered dimensions
  // beyond a baseline, and lightly outside education.
  const excessMeters = Math.max(0, meters - BASELINE.meters);
  if (excessMeters > 0) {
    const pts = deduct(Math.min(28, excessMeters * 3), w.usage);
    if (pts < 0) complexity.push({ label: `${meters} metered dimensions to track`, points: pts });
  }

  // Mixed pricing models — pure flat OR pure usage is clear; COMBINING fixed plans + usage +
  // add-ons means computing base + variable across axes, which is genuinely harder to predict.
  const mechanisms: string[] = [];
  if (paidTiers >= 1) mechanisms.push("fixed plans");
  if (meters >= 1) mechanisms.push("usage");
  if (tree.addOns.length >= 1) mechanisms.push("add-ons");
  if (mechanisms.length >= 2) {
    complexity.push({
      label: `Mixes ${mechanisms.join(" + ")} pricing`,
      points: deduct((mechanisms.length - 1) * 9, w.usage),
    });
  }

  // The sales wall — dominant negative. If there's no self-serve PAID price anywhere (only Free
  // and/or "contact sales"), you can't know what you'll pay without a sales call. A contact-sales
  // Enterprise tier sitting ON TOP of real self-serve pricing is normal and barely dings.
  let selfServePaid = paidTiers;
  for (const t of tree.tiers) {
    for (const g of t.options ?? []) for (const c of g.choices) if (isPaidPrice(c.price)) selfServePaid++;
  }
  for (const d of raw.usageDimensions) if (isPaidPrice(d.price)) selfServePaid++;
  if (selfServePaid === 0) {
    complexity.push({
      label: "No self-serve pricing — real cost needs a sales call",
      points: deduct(45, w.interaction),
    });
  } else if (meta.requiresInteraction) {
    complexity.push({ label: "Top tier is contact-sales (Enterprise)", points: -4 });
  }

  // A page too large to read in full is itself sprawling pricing — and lowers our confidence that
  // we captured all the complexity (so we also temper the scope credit below).
  const truncated = fetched?.truncated ?? false;
  if (truncated) {
    complexity.push({ label: "Sprawling pricing page — couldn't read it in full", points: -15 });
  }

  const items: ScoreLine[] = [{ label: "Base score", points: 100 }, ...complexity];

  // Scope adjustments — judge complexity RELATIVE to how much the platform offers.
  const services = Math.max(1, raw.services.length);
  const breadth = breadthPenalty(services);
  if (breadth > 0) {
    items.push({ label: `Spans ${services} distinct services to navigate`, points: -breadth });
  }

  // Forgive ONLY the breadth-driven complexity in proportion to scope (intrinsic per-component
  // complexity — metering, hidden costs — is never hand-waved away by "they have many services").
  // Partial relief — # of plans still counts (we don't fully forgive breadth just for scope).
  let reliefFactor = Math.min(0.45, 1 - 1 / Math.sqrt(services));
  if (truncated) reliefFactor *= 0.5; // less sure we captured everything
  const credit = Math.round(breadthMagnitude * reliefFactor);
  if (credit > 0) {
    items.push({
      label: `Plan breadth is reasonable for a ${services}-service platform`,
      points: credit,
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
export function agentScore(
  fetched: FetchResult,
  output: AgentOutput,
  opts: { scattered?: boolean } = {},
): ScoreResult {
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

  // Confidence gate: no genuine prices extracted means we couldn't actually read the pricing —
  // a heavy hit to agent easiness, not a free pass.
  const concrete = concretePriceCount(output);
  if (!output.meta.foundPricing) {
    items.push({ label: "No concrete pricing to parse", points: -40 });
  } else if (concrete === 0) {
    items.push({ label: "Couldn't extract any concrete prices (likely JS-rendered or gated)", points: -55 });
  }

  if (fetched.truncated) {
    items.push({ label: "Pricing page too large to read in full", points: -20 });
  }

  // The real rates weren't on the pricing page itself — we had to dig into docs/linked pages.
  if (opts.scattered) {
    items.push({ label: "Real pricing isn't on the pricing page (scattered across pages)", points: -20 });
  }

  if (output.meta.requiresInteraction) {
    items.push({ label: "Pricing gated behind interaction", points: -20 });
  }

  return { score: clamp(total(items)), items };
}
