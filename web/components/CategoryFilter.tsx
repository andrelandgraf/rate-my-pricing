import Link from "next/link";
import { CATEGORY_ORDER, CATEGORY_LABELS, CATEGORY_EMOJI, type SortKey } from "@/lib/types";

const SORT_DEFAULT: SortKey = "recent";

export default function CategoryFilter({
  active,
  sort,
}: {
  active: string;
  sort: SortKey;
}) {
  const sortQuery = sort === SORT_DEFAULT ? "" : `&sort=${sort}`;
  const options: { key: string; label: string; emoji: string }[] = [
    ...CATEGORY_ORDER.map((c) => ({ key: c, label: CATEGORY_LABELS[c], emoji: CATEGORY_EMOJI[c] })),
    { key: "all", label: "All", emoji: "✨" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = opt.key === active;
        return (
          <Link
            key={opt.key}
            href={`/?category=${opt.key}${sortQuery}`}
            scroll={false}
            className={`chip text-sm transition-colors ${
              isActive ? "bg-ink text-paper" : "hover:bg-sky"
            }`}
          >
            <span className="mr-1">{opt.emoji}</span>
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
