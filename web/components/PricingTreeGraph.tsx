"use client";

import { useState } from "react";
import type { TreeNode, TreeKind } from "@/lib/pricingTree";

const KIND_ACCENT: Record<TreeKind, string> = {
  root: "bg-marigold",
  group: "bg-paper-2",
  tier: "bg-sky",
  option: "bg-bubble",
  usage: "bg-coral",
  addon: "bg-grape",
  feature: "bg-lime",
  limit: "bg-bubble",
};

const KIND_EMOJI: Partial<Record<TreeKind, string>> = {
  group: "",
  tier: "🪜",
  option: "🔀",
  usage: "📊",
  addon: "🧩",
  feature: "✦",
  limit: "•",
};

function defaultOpen(node: TreeNode, depth: number): boolean {
  // Tiers start collapsed (expand to see features/limits). Big groups start collapsed to stay tidy.
  if (node.kind === "tier") return false;
  if (node.kind === "group" && (node.children?.length ?? 0) > 10) return false;
  return depth < 2;
}

function Node({ node, depth }: { node: TreeNode; depth: number }) {
  const hasChildren = !!node.children?.length;
  const [open, setOpen] = useState(() => defaultOpen(node, depth));

  if (node.kind === "feature" || node.kind === "limit") {
    return (
      <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
        <span className="flex items-center gap-2 text-ink-soft min-w-0">
          <span className={`shrink-0 ${node.kind === "feature" ? "text-lime" : "text-bubble"}`}>
            {node.kind === "feature" ? "✦" : "•"}
          </span>
          <span className="min-w-0 break-words">{node.label}</span>
        </span>
        {node.value && (
          <span className="font-semibold text-right min-w-0 break-words">{node.value}</span>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => hasChildren && setOpen((o) => !o)}
        aria-expanded={hasChildren ? open : undefined}
        className={`group w-full text-left card ${
          node.kind === "root" ? "card-lg p-4 sm:p-5" : "p-3 sm:p-3.5"
        } ${node.highlighted ? "ring-0" : ""} ${hasChildren ? "cursor-pointer hover:-translate-y-0.5 transition-transform" : "cursor-default"} flex items-center gap-3`}
      >
        <span
          className={`shrink-0 ink-border rounded-lg w-8 h-8 flex items-center justify-center font-display font-extrabold ${
            KIND_ACCENT[node.kind]
          }`}
        >
          {hasChildren ? (open ? "▾" : "▸") : (KIND_EMOJI[node.kind] ?? "•")}
        </span>

        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-display font-extrabold ${
                node.kind === "root" ? "text-2xl" : node.kind === "group" ? "text-lg" : "text-base"
              } break-words`}
            >
              {node.label}
            </span>
            {node.highlighted && <span className="animate-wobble">⭐</span>}
            {node.meta && (
              <span className="chip bg-paper-2 text-xs font-mono">{node.meta}</span>
            )}
          </span>
        </span>

        {node.value && (
          <span className="min-w-0 max-w-[50%] break-words font-display font-extrabold text-right">
            {node.value}
          </span>
        )}
      </button>

      {hasChildren && open && (
        <div className="ml-4 sm:ml-5 mt-2 pl-4 sm:pl-5 border-l-2 border-dashed border-ink/25 flex flex-col gap-2">
          {node.kind === "tier" ? (
            <div className="flex flex-col">
              {node.children!.map((c) => (
                <Node key={c.id} node={c} depth={depth + 1} />
              ))}
            </div>
          ) : (
            node.children!.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)
          )}
        </div>
      )}
    </div>
  );
}

export default function PricingTreeGraph({ root }: { root: TreeNode }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <h3 className="font-display font-extrabold text-2xl">The pricing tree 🌳</h3>
        <span className="text-sm text-ink-soft">tap any branch to explore</span>
      </div>
      <Node node={root} depth={0} />
    </section>
  );
}
