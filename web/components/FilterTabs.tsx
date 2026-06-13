import Link from "next/link";
import type { SortKey } from "@/lib/types";

const TABS: { key: SortKey; label: string; emoji: string }[] = [
  { key: "worst", label: "Worst offenders", emoji: "💀" },
  { key: "best", label: "Best pricing", emoji: "🏆" },
  { key: "agent", label: "Best for agents", emoji: "🤖" },
  { key: "recent", label: "Fresh drops", emoji: "🆕" },
];

const CATEGORY_DEFAULT = "devtools";

export default function FilterTabs({ active, category }: { active: SortKey; category: string }) {
  const catQuery = category === CATEGORY_DEFAULT ? "" : `category=${category}`;
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const params = [catQuery, tab.key === "recent" ? "" : `sort=${tab.key}`].filter(Boolean);
        const href = params.length ? `/?${params.join("&")}` : "/";
        return (
          <Link
            key={tab.key}
            href={href}
            scroll={false}
            className={`chip text-sm transition-colors ${
              isActive ? "bg-ink text-paper" : "hover:bg-marigold"
            }`}
          >
            <span className="mr-1">{tab.emoji}</span>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
