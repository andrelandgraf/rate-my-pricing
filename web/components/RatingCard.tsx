import Link from "next/link";
import type { RatingSummary } from "@/lib/types";
import { hostOf, timeAgo } from "@/lib/format";
import ScorePill from "./ScorePill";

const ACCENTS = ["bg-marigold", "bg-sky", "bg-lime", "bg-bubble", "bg-grape", "bg-coral"];

export default function RatingCard({ rating, rank }: { rating: RatingSummary; rank: number }) {
  const accent = ACCENTS[rank % ACCENTS.length];
  return (
    <Link
      href={`/${rating.slug}`}
      className="card hover-pop p-4 flex items-center gap-4 group"
    >
      <div
        className={`shrink-0 w-11 h-11 rounded-xl ink-border ${accent} grid place-items-center font-display font-extrabold text-lg`}
      >
        {rank + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display font-extrabold text-lg leading-tight truncate">
          {rating.title}
        </div>
        <div className="text-sm text-ink-soft font-mono truncate">
          {hostOf(rating.url)} · {timeAgo(rating.createdAt)}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ScorePill score={rating.pricingScore} emoji="🧾" title="Pricing clarity" />
        <ScorePill score={rating.agentScore} emoji="🤖" title="Agent easiness" />
      </div>
    </Link>
  );
}
