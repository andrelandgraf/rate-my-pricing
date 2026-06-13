import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "The Heuristic — how the machine makes up its mind · Rate My Pricing",
  description:
    "A peek under the hood: the chain of AI agents that read a pricing page and the transparent points system that scores it.",
};

const STEPS: {
  n: number;
  accent: string;
  name: string;
  model: string;
  body: string;
}[] = [
  {
    n: 1,
    accent: "bg-marigold",
    name: "The Scout",
    model: "GPT-5 mini",
    body:
      "Given any URL, it hunts down the real pricing page — following navigation links, the sitemap, and a site's own machine-readable index. If the page just links out to the rates (a docs or detail page), it digs one level deeper. It will never settle for a blog post that merely mentions pricing.",
  },
  {
    n: 2,
    accent: "bg-sky",
    name: "The Reader",
    model: "GPT-5",
    body:
      "Reads the page as untrusted data and pulls out only the literal pricing structure: plans, prices, metered dimensions, add-ons, and in-plan options. It ignores any text trying to instruct or flatter it, so a page can't talk its way to a better score. If the quick read looks suspiciously thin, it does a full browser render and tries again.",
  },
  {
    n: 3,
    accent: "bg-lime",
    name: "The Librarian",
    model: "GPT-5",
    body:
      "Looks at the whole page to name the company and file it into one shelf: DevTools, PaaS, Hyperscaler, AI Lab, SaaS, or Education. The category sets the expectations the scorer judges against.",
  },
  {
    n: 4,
    accent: "bg-grape",
    name: "The Analyst",
    model: "GPT-5",
    body:
      "Sees only the clean, structured data — never the raw page — and works out the billing model and a plain-language summary. Because it can't read the page text, injected prose can't sway its judgement.",
  },
  {
    n: 5,
    accent: "bg-bubble",
    name: "The Scorer",
    model: "pure math · no model",
    body:
      "A transparent points system. It doesn't ask a model for a number — it counts the structure (plans, meters, add-ons, sales walls) and adds up named deductions. Every point on a result page is one of these lines.",
  },
  {
    n: 6,
    accent: "bg-coral",
    name: "The Judge",
    model: "GPT-5 mini",
    body:
      "A final QA pass. It compares the finished result against the page it read and flags anything that went wrong — wrong page, wrong company, missing details, an implausible score — so regressions get caught before they're published.",
  },
];

const PRICING_DEDUCTIONS: { label: string; cost: string }[] = [
  { label: "Each plan beyond 3 to compare (a free tier counts for less)", cost: "−6, up to −24" },
  { label: "Mixing pricing models (flat + usage + add-ons all at once)", cost: "−9 per model" },
  { label: "Each metered dimension beyond 3 to track", cost: "−3, up to −28" },
  { label: "Each add-on beyond 2", cost: "−4, up to −16" },
  { label: "Each in-plan config choice beyond 4 (machine sizes, regions…)", cost: "−2, up to −20" },
  { label: "No self-serve price anywhere — you must call sales", cost: "−45  (the big one)" },
  { label: "A contact-sales Enterprise tier sitting on top of real pricing", cost: "−4  (barely)" },
  { label: "Pricing page too sprawling to read in full", cost: "−15" },
];

const AGENT_DEDUCTIONS: { label: string; cost: string }[] = [
  { label: "Couldn't load the page at all", cost: "−100" },
  { label: "No clean machine-readable version — had to parse raw HTML", cost: "−15" },
  { label: "Couldn't find any real prices to read", cost: "−40 to −55" },
  { label: "Page too large to read in one go", cost: "−20" },
  { label: "Real prices weren't on the pricing page (scattered across sub-pages)", cost: "−20" },
  { label: "Prices gated behind a login or sales call", cost: "−20" },
];

export default function TheHeuristicPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 pt-12 pb-8 text-center">
          <div className="inline-block chip bg-marigold mb-5 animate-float-slow">
            🧠 how the machine makes up its mind
          </div>
          <h1 className="font-display font-extrabold text-[2.6rem] sm:text-6xl leading-[0.98] tracking-tight">
            The <span className="text-coral">Heuristic</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-ink-soft font-medium max-w-xl mx-auto">
            Every rating runs an assembly line of small AI agents — each with one job — and ends in a
            transparent points system. No black-box vibes; here&apos;s exactly how it works.
          </p>
        </section>

        {/* Agent assembly line */}
        <section className="mx-auto max-w-3xl px-4">
          <h2 className="font-display font-extrabold text-3xl mb-6">The assembly line 🛠️</h2>
          <div className="flex flex-col gap-3">
            {STEPS.map((s, i) => (
              <div key={s.n}>
                <div className="card p-5 flex items-start gap-4">
                  <div
                    className={`shrink-0 ink-border rounded-xl w-10 h-10 flex items-center justify-center font-display font-extrabold text-lg ${s.accent}`}
                  >
                    {s.n}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display font-extrabold text-xl">{s.name}</span>
                      <span className="chip bg-paper-2 text-xs font-mono">{s.model}</span>
                    </div>
                    <p className="mt-1.5 text-ink-soft font-medium text-[0.97rem]">{s.body}</p>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="text-center text-2xl text-ink/40 leading-none py-1">↓</div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-ink-soft font-medium">
            The data narrows as it flows: a messy page becomes clean structured facts, and only those
            facts — never the raw page — reach the parts that judge and score. That&apos;s also the
            trick that makes it prompt-injection-proof.
          </p>
        </section>

        {/* Scoring */}
        <section className="mx-auto max-w-5xl px-4 pt-12">
          <h2 className="font-display font-extrabold text-3xl mb-2">How the score is built 🧮</h2>
          <p className="text-ink-soft font-medium mb-6 max-w-2xl">
            Two scores, each starting at <span className="font-bold text-ink">100</span>. A clear,
            normal pricing page keeps almost all of it — points only come off for genuine friction.
          </p>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Pricing clarity */}
            <div className="card card-lg p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🧾</span>
                <h3 className="font-display font-extrabold text-2xl">Pricing clarity</h3>
              </div>
              <p className="text-ink-soft font-medium text-sm mb-4">
                Can a buyer quickly understand what they&apos;ll pay and predict the bill?
              </p>

              <div className="chip bg-lime inline-block mb-3 text-sm">Free baseline — no penalty</div>
              <ul className="flex flex-wrap gap-2 mb-5 text-sm">
                {["up to 3 plans", "4 in-plan options", "2 add-ons", "3 metered dimensions"].map(
                  (b) => (
                    <li key={b} className="chip bg-paper-2">
                      ✓ {b}
                    </li>
                  ),
                )}
              </ul>

              <div className="font-display font-bold mb-2">Then points come off for friction</div>
              <ul className="flex flex-col gap-2">
                {PRICING_DEDUCTIONS.map((d) => (
                  <li
                    key={d.label}
                    className="flex items-baseline justify-between gap-3 border-b border-dashed border-ink/20 pb-1.5 text-sm"
                  >
                    <span className="font-medium">{d.label}</span>
                    <span className="font-mono font-bold text-coral whitespace-nowrap">{d.cost}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 card p-3 bg-sky/15 text-sm font-medium">
                💡 Usage-based pricing is <span className="font-bold">not</span> punished for
                existing — it&apos;s fair, pay-for-what-you-use. Only the <em>complexity</em> of many
                meters counts, and barely so for dev tools, platforms, clouds &amp; AI labs (it&apos;s
                expected there). Education is the exception — pricing should be flat.
              </div>
              <div className="mt-3 card p-3 bg-marigold/20 text-sm font-medium">
                🧱 Scope-aware: a platform that sells 40 things will naturally have more plans. That
                breadth is largely forgiven — but per-product complexity (lots of meters) is not.
              </div>
            </div>

            {/* Agent easiness */}
            <div className="card card-lg p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🤖</span>
                <h3 className="font-display font-extrabold text-2xl">Agent easiness</h3>
              </div>
              <p className="text-ink-soft font-medium text-sm mb-4">
                Could an AI agent actually read and understand the page on its own?
              </p>

              <div className="chip bg-lime inline-block mb-3 text-sm">
                A clean, self-contained pricing page = 100
              </div>

              <div className="font-display font-bold mb-2">Points come off when reading is hard</div>
              <ul className="flex flex-col gap-2">
                {AGENT_DEDUCTIONS.map((d) => (
                  <li
                    key={d.label}
                    className="flex items-baseline justify-between gap-3 border-b border-dashed border-ink/20 pb-1.5 text-sm"
                  >
                    <span className="font-medium">{d.label}</span>
                    <span className="font-mono font-bold text-coral whitespace-nowrap">{d.cost}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 card p-3 bg-grape/15 text-sm font-medium">
                🔎 This is separate from clarity on purpose: the pricing might be perfectly clear to a
                human, but if an agent has to render JavaScript or dig through sub-pages to find the
                rates, that&apos;s a worse experience — and it shows here.
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link href="/" className="chip bg-sky text-sm hover:bg-marigold transition-colors">
              ← back to the leaderboard
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
