import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SubmitForm from "@/components/SubmitForm";
import FilterTabs from "@/components/FilterTabs";
import RatingCard from "@/components/RatingCard";
import { fetchLeaderboard } from "@/lib/api";
import type { SortKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS: SortKey[] = ["worst", "best", "agent", "recent"];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const params = await searchParams;
  const sort: SortKey = SORTS.includes(params.sort as SortKey)
    ? (params.sort as SortKey)
    : "recent";

  const ratings = await fetchLeaderboard(sort);

  return (
    <>
      <Header />
      <main className="flex-1">
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
            <SubmitForm autofocus />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-ink-soft font-medium">
            <span>🧾 pricing clarity</span>
            <span>🤖 agent easiness</span>
            <span>🎉 confetti at 100/100</span>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
            <h2 className="font-display font-extrabold text-3xl">The leaderboard</h2>
            <FilterTabs active={sort} />
          </div>

          {ratings.length === 0 ? (
            <div className="card card-lg p-10 text-center">
              <div className="text-5xl mb-3">🫙</div>
              <p className="font-display font-bold text-xl">No ratings yet — be the first!</p>
              <p className="text-ink-soft">Paste a pricing page above and watch the agent go.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {ratings.map((r, i) => (
                <RatingCard key={r.slug} rating={r} rank={i} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
