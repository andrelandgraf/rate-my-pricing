import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScoreGauge from "@/components/ScoreGauge";
import PricingTreeView from "@/components/PricingTreeView";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import RegenerateButton from "@/components/RegenerateButton";
import ShareButton from "@/components/ShareButton";
import Confetti from "@/components/Confetti";
import { fetchRating } from "@/lib/api";
import { pricingLabel, agentLabel, hostOf, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const rating = await fetchRating(slug);
  if (!rating) return { title: "Not found · Rate My Pricing" };
  const title = `${rating.title} — pricing ${rating.pricingScore}/100 · Rate My Pricing`;
  const description =
    rating.summary ||
    `${rating.title}: pricing clarity ${rating.pricingScore}/100, agent easiness ${rating.agentScore}/100.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RatingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const rating = await fetchRating(slug);
  if (!rating) notFound();

  const perfect = rating.pricingScore === 100 && rating.agentScore === 100;

  return (
    <>
      {perfect && <Confetti />}
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 pt-8">
          <Link href="/" className="chip text-sm hover:bg-marigold transition-colors">
            ← leaderboard
          </Link>
        </div>

        <section className="mx-auto max-w-5xl px-4 pt-6">
          <div className="card card-lg p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start">
              <div className="flex-1 min-w-0 text-center lg:text-left">
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-3">
                  <span className="chip bg-paper-2 text-sm font-mono">
                    {rating.source === "markdown" ? "📄 markdown" : "🌐 html"}
                  </span>
                  <span className="chip bg-paper-2 text-sm">🕑 {timeAgo(rating.createdAt)}</span>
                  {perfect && <span className="chip bg-lime text-sm animate-wobble">🎉 perfect score</span>}
                </div>
                <h1 className="font-display font-extrabold text-4xl sm:text-5xl leading-[0.95] tracking-tight break-words">
                  {rating.title}
                </h1>
                <a
                  href={rating.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-2 font-mono text-ink-soft underline decoration-dotted break-all"
                >
                  {hostOf(rating.url)} ↗
                </a>
                {rating.summary && (
                  <p className="mt-4 text-lg font-medium max-w-2xl">{rating.summary}</p>
                )}
                {rating.parseNotes && (
                  <p className="mt-3 card p-3 bg-marigold/20 text-sm font-semibold inline-flex items-center gap-2">
                    <span>🛟</span> {rating.parseNotes}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-3 justify-center lg:justify-start">
                  <ShareButton
                    title={rating.title}
                    pricingScore={rating.pricingScore}
                    agentScore={rating.agentScore}
                  />
                  <RegenerateButton url={rating.url} updatedAt={rating.updatedAt} />
                  <span className="text-sm text-ink-soft">
                    model: <span className="font-mono">{rating.model || "—"}</span>
                  </span>
                </div>
              </div>

              <div className="flex gap-6 sm:gap-10 shrink-0">
                <ScoreGauge
                  score={rating.pricingScore}
                  label="Pricing clarity"
                  caption={pricingLabel(rating.pricingScore)}
                  emoji="🧾"
                />
                <ScoreGauge
                  score={rating.agentScore}
                  label="Agent easiness"
                  caption={agentLabel(rating.agentScore)}
                  emoji="🤖"
                />
              </div>
            </div>
          </div>
        </section>

        {rating.breakdown && (
          <section className="mx-auto max-w-5xl px-4 pt-10">
            <ScoreBreakdown
              breakdown={rating.breakdown}
              pricingScore={rating.pricingScore}
              agentScore={rating.agentScore}
            />
          </section>
        )}

        <section className="mx-auto max-w-5xl px-4 pt-10">
          <PricingTreeView tree={rating.tree} />
        </section>
      </main>
      <Footer />
    </>
  );
}
