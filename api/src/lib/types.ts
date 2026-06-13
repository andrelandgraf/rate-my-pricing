import { z } from "zod";

/**
 * The standardized pricing tree the agent extracts from any pricing page.
 * Kept intentionally generic so wildly different pricing models still map onto it.
 */
export const limitSchema = z.object({
  label: z.string().describe("Name of the limit/quota, e.g. 'Seats', 'API calls'"),
  value: z.string().describe("The value or cap, e.g. 'Unlimited', '10,000 / mo'"),
});

export const tierSchema = z.object({
  name: z.string().describe("Tier name, e.g. 'Free', 'Pro', 'Enterprise'"),
  price: z.string().describe("Headline price as shown, e.g. '$20', 'Free', 'Custom'"),
  period: z
    .string()
    .describe("Billing period for the price, e.g. 'per month', 'per user / mo', '' if none"),
  highlighted: z.boolean().describe("True if the page marks this as the recommended/popular tier"),
  features: z.array(z.string()).describe("Notable features or inclusions listed for this tier"),
  limits: z.array(limitSchema).describe("Quantitative limits / quotas for this tier"),
});

export const addOnSchema = z.object({
  name: z.string(),
  price: z.string().describe("Price as shown or '' if unknown"),
  description: z.string().describe("Short description of the add-on / package"),
});

export const pricingTreeSchema = z.object({
  productName: z.string().describe("Product or company name"),
  currency: z.string().describe("Currency symbol or code, e.g. '$', 'USD', 'EUR', '' if unknown"),
  billingModel: z
    .enum(["flat", "tiered", "usage", "per-seat", "hybrid", "unknown"])
    .describe("The dominant pricing model"),
  tiers: z.array(tierSchema).describe("Each plan / tier offered"),
  addOns: z.array(addOnSchema).describe("Add-ons, additional packages, or paid extras"),
  hiddenCostSignals: z
    .array(z.string())
    .describe(
      "Things that make pricing hard to reason about: usage overages, metered dimensions, contact-sales gates, annual-only discounts, complex calculators, etc.",
    ),
  notes: z.string().describe("One or two sentence plain-language summary of the pricing."),
});

export type PricingTree = z.infer<typeof pricingTreeSchema>;

export const parseMetaSchema = z.object({
  requiresInteraction: z
    .boolean()
    .describe("True if real pricing is hidden behind a calculator, login, or 'contact sales'."),
  foundPricing: z.boolean().describe("True if any concrete pricing information was found at all."),
});

export type ParseMeta = z.infer<typeof parseMetaSchema>;

/**
 * Step 1 (extractor) output: ONLY the literal, factual pricing structure present on the page.
 * No sentiment, no judgment, no "hidden cost signals" — those are derived in step 2 from this
 * clean structure, so injected prose in the raw page can't influence the rating.
 */
export const usageDimensionSchema = z.object({
  name: z.string().describe("What is metered, e.g. 'Errors', 'Bandwidth', 'Seats', 'Build minutes'."),
  unit: z.string().describe("The billing unit, e.g. 'per GB', 'per 1k requests', 'per seat/mo'."),
  price: z.string().describe("Price per unit as shown, e.g. '$0.50', '$0.0003625'. '' if unknown."),
  included: z.string().describe("Amount included before charges begin, e.g. '5k/mo'. '' if none/unknown."),
});

export type UsageDimension = z.infer<typeof usageDimensionSchema>;

export const extractionSchema = z.object({
  productName: z.string().describe("Brand/company name (e.g. 'Stripe'), NEVER a heading like 'Pricing'."),
  currency: z.string().describe("Currency symbol/code, e.g. '$', 'USD', '' if unknown."),
  tiers: z.array(tierSchema).describe("Each plan/tier literally listed, with its real prices."),
  addOns: z.array(addOnSchema).describe("Add-ons / additional paid packages literally listed."),
  usageDimensions: z
    .array(usageDimensionSchema)
    .describe("Metered / pay-as-you-go billing axes. Empty if pricing is purely flat/tiered."),
  foundPricing: z.boolean().describe("True only if concrete prices are actually present."),
  requiresInteraction: z
    .boolean()
    .describe("True only if real prices are gated behind contact-sales/login/calculator."),
});

export type Extraction = z.infer<typeof extractionSchema>;

/**
 * Step 2 (analyst) output: judgment derived ONLY from the clean structured extraction above.
 */
export const analysisSchema = z.object({
  billingModel: z
    .enum(["flat", "tiered", "usage", "per-seat", "hybrid", "unknown"])
    .describe("Dominant pricing model, inferred from the structured tiers."),
  hiddenCostSignals: z
    .array(z.string())
    .describe(
      "Concrete things in the STRUCTURE that make the bill hard to predict (usage/metered " +
        "dimensions, per-seat scaling, many add-ons, contact-sales gates, annual-only discounts). " +
        "Be conservative; base only on the structured data, never on marketing claims.",
    ),
  notes: z
    .string()
    .describe("One or two sentence NEUTRAL, factual summary. No marketing or opinions."),
});

export type Analysis = z.infer<typeof analysisSchema>;

export const agentOutputSchema = z.object({
  tree: pricingTreeSchema,
  meta: parseMetaSchema,
});

export type AgentOutput = z.infer<typeof agentOutputSchema> & { raw: Extraction };

export const CATEGORIES = ["devtools", "clouds", "ai-labs", "saas", "educational", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const categorizationSchema = z.object({
  category: z
    .enum(CATEGORIES)
    .describe(
      "The single best-fit category: devtools (developer tools & platforms builders build with or " +
        "deploy to), clouds (hyperscalers / broad data platforms: AWS, GCP, Azure, Snowflake, " +
        "Databricks), ai-labs (foundation-model providers only: OpenAI, Anthropic, Mistral), saas " +
        "(general business/consumer apps not aimed at developers: link-in-bio, productivity, CRM, " +
        "newsletters), educational (courses, bootcamps, learning), other (none of the above).",
    ),
});

export type Categorization = z.infer<typeof categorizationSchema>;

export type FetchResult = {
  ok: boolean;
  status: number;
  source: "markdown" | "html" | "none";
  content: string;
  finalUrl: string;
};
