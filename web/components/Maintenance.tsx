import Link from "next/link";

/** Shown when the rating API is unreachable — friendlier than a fake "empty leaderboard". */
export default function Maintenance() {
  return (
    <section className="mx-auto max-w-2xl px-4 pt-16 pb-24 text-center">
      <div className="inline-block chip bg-marigold mb-6 animate-float-slow">
        🚧 temporarily under construction
      </div>
      <div className="text-7xl mb-4 animate-wobble inline-block">🤖💤</div>
      <h1 className="font-display font-extrabold text-4xl sm:text-5xl leading-[0.98] tracking-tight">
        The rating agent is <span className="text-coral">taking a breather</span>
      </h1>
      <p className="mt-5 text-base sm:text-lg text-ink-soft font-medium max-w-md mx-auto">
        We couldn&apos;t reach the pricing agent just now — likely a brief hiccup. Your ratings are
        safe; give it a moment and refresh.
      </p>
      <div className="mt-8">
        <Link href="/" className="btn-pop bg-coral text-ink px-7 py-3 text-lg inline-block">
          ↻ Try again
        </Link>
      </div>
    </section>
  );
}
