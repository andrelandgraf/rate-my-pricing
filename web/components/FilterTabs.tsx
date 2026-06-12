import Link from "next/link";
import type { SortKey } from "@/lib/types";

const TABS: { key: SortKey; label: string; emoji: string }[] = [
  { key: "worst", label: "Worst offenders", emoji: "💀" },
  { key: "best", label: "Best pricing", emoji: "🏆" },
  { key: "agent", label: "Best for agents", emoji: "🤖" },
  { key: "recent", label: "Fresh drops", emoji: "🆕" },
];

export default function FilterTabs({ active }: { active: SortKey }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.key === "recent" ? "/" : `/?sort=${tab.key}`}
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
