import type { Extraction, PricingTree } from "./types";

export type TreeKind = "root" | "group" | "tier" | "usage" | "addon" | "feature" | "limit";

export type TreeNode = {
  id: string;
  label: string;
  value?: string;
  meta?: string;
  kind: TreeKind;
  highlighted?: boolean;
  children?: TreeNode[];
};

const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ").trim();

/**
 * Build a render-ready, exploratory pricing tree from the CLEAN extraction (no raw HTML, no
 * model call) — deterministic and injection-proof. Returns null when there's nothing to show.
 */
export function buildPricingTree(
  raw: Extraction | null | undefined,
  tree: PricingTree,
): TreeNode | null {
  const tiers = raw?.tiers?.length ? raw.tiers : tree.tiers;
  const addOns = raw?.addOns?.length ? raw.addOns : tree.addOns;
  const usage = raw?.usageDimensions ?? [];
  const productName = raw?.productName || tree.productName || "Pricing";

  if (!tiers.length && !addOns.length && !usage.length) return null;

  const children: TreeNode[] = [];

  if (tiers.length) {
    children.push({
      id: "plans",
      kind: "group",
      label: "Plans",
      meta: `${tiers.length} tier${tiers.length === 1 ? "" : "s"}`,
      children: tiers.map((tier, i) => ({
        id: `tier-${i}`,
        kind: "tier",
        label: tier.name || `Plan ${i + 1}`,
        value: join(tier.price, tier.period),
        highlighted: tier.highlighted,
        children: [
          ...tier.limits.map((l, j) => ({
            id: `tier-${i}-limit-${j}`,
            kind: "limit" as const,
            label: l.label,
            value: l.value,
          })),
          ...tier.features.map((f, j) => ({
            id: `tier-${i}-feat-${j}`,
            kind: "feature" as const,
            label: f,
          })),
        ],
      })),
    });
  }

  if (usage.length) {
    children.push({
      id: "usage",
      kind: "group",
      label: "Usage-based",
      meta: `${usage.length} metered`,
      children: usage.map((d, i) => ({
        id: `usage-${i}`,
        kind: "usage",
        label: d.name,
        value: join(d.price, d.unit),
        meta: d.included ? `includes ${d.included}` : undefined,
      })),
    });
  }

  if (addOns.length) {
    children.push({
      id: "addons",
      kind: "group",
      label: "Add-ons",
      meta: `${addOns.length} extra${addOns.length === 1 ? "" : "s"}`,
      children: addOns.map((a, i) => ({
        id: `addon-${i}`,
        kind: "addon",
        label: a.name,
        value: a.price || undefined,
        meta: a.description || undefined,
      })),
    });
  }

  return {
    id: "root",
    kind: "root",
    label: productName,
    value: tree.currency || undefined,
    meta: tree.billingModel !== "unknown" ? `${tree.billingModel} pricing` : undefined,
    children,
  };
}
