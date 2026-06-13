export const CATEGORY_ORDER = [
  "devtools",
  "paas",
  "hyperscaler",
  "ai-lab",
  "saas",
  "educational",
  "other",
] as const;
export type Category = (typeof CATEGORY_ORDER)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
  devtools: "DevTools",
  paas: "PaaS",
  hyperscaler: "Hyperscalers",
  "ai-lab": "AI Labs",
  saas: "SaaS",
  educational: "Educational",
  other: "Other",
};
export const CATEGORY_EMOJI: Record<Category, string> = {
  devtools: "🛠️",
  paas: "🚀",
  hyperscaler: "☁️",
  "ai-lab": "🧪",
  saas: "💼",
  educational: "🎓",
  other: "📦",
};

export type Limit = { label: string; value: string };

export type OptionChoice = { label: string; price: string };
export type OptionGroup = { name: string; choices: OptionChoice[] };

export type Tier = {
  name: string;
  price: string;
  period: string;
  highlighted: boolean;
  features: string[];
  limits: Limit[];
  options?: OptionGroup[];
};

export type AddOn = { name: string; price: string; description: string };

export type UsageDimension = { name: string; unit: string; price: string; included: string };

/** Clean, injection-free facts from the extractor (step 1). Source of the pricing tree. */
export type Extraction = {
  productName: string;
  currency: string;
  tiers: Tier[];
  addOns: AddOn[];
  usageDimensions: UsageDimension[];
  services: string[];
  foundPricing: boolean;
  requiresInteraction: boolean;
};

export type PricingTree = {
  productName: string;
  currency: string;
  billingModel: "flat" | "tiered" | "usage" | "per-seat" | "hybrid" | "unknown";
  tiers: Tier[];
  addOns: AddOn[];
  hiddenCostSignals: string[];
  notes: string;
};

export type ScoreLine = { label: string; points: number };
export type Breakdown = { pricing: ScoreLine[]; agent: ScoreLine[] };

export type Rating = {
  id: number;
  slug: string;
  url: string;
  title: string;
  summary: string;
  category: Category;
  pricingScore: number;
  agentScore: number;
  tree: PricingTree;
  breakdown: Breakdown | null;
  rawExtraction: Extraction | null;
  source: "markdown" | "html" | "none";
  model: string;
  fetchOk: boolean;
  listed: boolean;
  parseNotes: string;
  views: number;
  createdAt: string;
  updatedAt: string;
};

export type RatingSummary = Pick<
  Rating,
  | "slug"
  | "url"
  | "title"
  | "summary"
  | "category"
  | "pricingScore"
  | "agentScore"
  | "source"
  | "createdAt"
>;

export type SortKey = "worst" | "best" | "agent" | "recent";

export type RateResponse = { cached: boolean; rating: Rating };
