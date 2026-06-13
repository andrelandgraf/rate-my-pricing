export const CATEGORY_ORDER = ["devtools", "clouds", "ai-labs", "educational", "other"] as const;
export type Category = (typeof CATEGORY_ORDER)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
  devtools: "DevTools",
  clouds: "Clouds",
  "ai-labs": "AI Labs",
  educational: "Educational",
  other: "Other",
};
export const CATEGORY_EMOJI: Record<Category, string> = {
  devtools: "🛠️",
  clouds: "☁️",
  "ai-labs": "🧪",
  educational: "🎓",
  other: "📦",
};

export type Limit = { label: string; value: string };

export type Tier = {
  name: string;
  price: string;
  period: string;
  highlighted: boolean;
  features: string[];
  limits: Limit[];
};

export type AddOn = { name: string; price: string; description: string };

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
