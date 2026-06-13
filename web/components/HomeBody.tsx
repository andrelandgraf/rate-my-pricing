"use client";

import { useMemo, useState } from "react";
import SubmitForm from "@/components/SubmitForm";
import FilterTabs from "@/components/FilterTabs";
import CategoryFilter from "@/components/CategoryFilter";
import RatingCard from "@/components/RatingCard";
import { hostOf } from "@/lib/format";
import { CATEGORY_LABELS, type Category, type RatingSummary, type SortKey } from "@/lib/types";

export default function HomeBody({
  ratings,
  sort,
  category,
}: {
  ratings: RatingSummary[];
  sort: SortKey;
  category: string;
}) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return ratings;
    return ratings.filter((r) =>
      `${r.title} ${hostOf(r.url)} ${r.slug}`.toLowerCase().includes(q),
    );
  }, [ratings, q]);

  const categoryLabel =
    category === "all" ? "All" : (CATEGORY_LABELS[category as Category] ?? "DevTools");

  return (
    <>
      <section className="mx-auto max-w-3xl px-4 pt-12 pb-10 text-center">
        <div className="inline-block chip bg-marigold mb-5 animate-float-slow">
          👀 the pricing-page roast machine
        </div>
        <h1 className="font-display font-extrabold text-[2.6rem] sm:text-6xl leading-[0.98] sm:leading-[0.95] tracking-tight text-balance">
          How <span className="text-coral">confusing</span> is
          <br className="hidden sm:inline" /> that{" "}
          <span className="underline decoration-wavy decoration-sky">pricing page</span>?
        </h1>
        <p className="mt-5 text-base sm:text-lg text-ink-soft font-medium max-w-xl mx-auto">
          Paste any pricing URL. An AI agent reads it, untangles the tiers, and hands out two
          scores — like Lighthouse, but for pricing pages.
        </p>
        <div className="mt-8">
          <SubmitForm autofocus onQueryChange={setQuery} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-ink-soft font-medium">
          <span>🧾 pricing clarity</span>
          <span>🤖 agent easiness</span>
          <span>🎉 confetti at 100/100</span>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4">
        <h2 className="font-display font-extrabold text-3xl mb-4">
          {q ? (
            <>
              Matching <span className="text-coral">“{query.trim()}”</span>
            </>
          ) : (
            <>
              The <span className="text-coral">{categoryLabel}</span> leaderboard
            </>
          )}
        </h2>

        <div className="flex flex-col gap-2.5 mb-6">
          <CategoryFilter active={category} sort={sort} />
          <FilterTabs active={sort} category={category} />
        </div>

        {ratings.length === 0 ? (
          <div className="card card-lg p-10 text-center">
            <div className="text-5xl mb-3">🫙</div>
            <p className="font-display font-bold text-xl">Nothing in {categoryLabel} yet</p>
            <p className="text-ink-soft">Paste a pricing page above, or try another category.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card card-lg p-10 text-center">
            <div className="text-5xl mb-3">🔍</div>
            <p className="font-display font-bold text-xl">No match for “{query.trim()}”</p>
            <p className="text-ink-soft">
              Hit <span className="font-semibold">Rate it!</span> above to score it, or switch
              category.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((r, i) => (
              <RatingCard key={r.slug} rating={r} rank={i} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
