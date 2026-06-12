import type { Breakdown, ScoreLine } from "@/lib/types";
import { scoreColor } from "@/lib/format";

function Column({
  title,
  emoji,
  items,
  score,
}: {
  title: string;
  emoji: string;
  items: ScoreLine[];
  score: number;
}) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-extrabold text-xl flex items-center gap-2">
          <span>{emoji}</span> {title}
        </h3>
        <span
          className="font-display font-extrabold text-2xl"
          style={{ color: scoreColor(score) }}
        >
          {score}
        </span>
      </div>
      <ul className="flex flex-col">
        {items.map((item, i) => {
          const isBase = i === 0;
          return (
            <li
              key={i}
              className="flex items-center justify-between gap-3 border-b border-dashed border-ink/15 py-1.5 last:border-0"
            >
              <span className={isBase ? "font-semibold" : "text-ink-soft"}>{item.label}</span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  item.points < 0 ? "text-coral" : "text-ink"
                }`}
              >
                {item.points > 0 ? `+${item.points}` : item.points}
              </span>
            </li>
          );
        })}
        <li className="flex items-center justify-between gap-3 pt-2 mt-1 border-t-2 border-ink">
          <span className="font-display font-extrabold">Total</span>
          <span
            className="font-display font-extrabold text-lg"
            style={{ color: scoreColor(score) }}
          >
            {score} / 100
          </span>
        </li>
      </ul>
    </div>
  );
}

export default function ScoreBreakdown({
  breakdown,
  pricingScore,
  agentScore,
}: {
  breakdown: Breakdown;
  pricingScore: number;
  agentScore: number;
}) {
  return (
    <section>
      <h2 className="font-display font-extrabold text-2xl mb-1">How we scored it 🧮</h2>
      <p className="text-ink-soft font-medium mb-4">
        Every page starts at 100. Each kind of complexity subtracts points — here&apos;s the math.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Column
          title="Pricing clarity"
          emoji="🧾"
          items={breakdown.pricing}
          score={pricingScore}
        />
        <Column title="Agent easiness" emoji="🤖" items={breakdown.agent} score={agentScore} />
      </div>
    </section>
  );
}
