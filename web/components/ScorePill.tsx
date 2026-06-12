import { scoreColor } from "@/lib/format";

export default function ScorePill({
  score,
  emoji,
  title,
}: {
  score: number;
  emoji: string;
  title: string;
}) {
  const color = scoreColor(score);
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border-2 border-ink px-2.5 py-1 font-display font-extrabold text-sm"
      style={{ background: `${color}22` }}
      title={title}
    >
      <span className="text-base leading-none">{emoji}</span>
      <span style={{ color }}>{score}</span>
    </div>
  );
}
