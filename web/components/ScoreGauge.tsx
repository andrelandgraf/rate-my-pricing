"use client";

import { useEffect, useState } from "react";
import { scoreColor } from "@/lib/format";

type Props = {
  score: number;
  label: string;
  caption: string;
  emoji: string;
  size?: number;
  animate?: boolean;
};

export default function ScoreGauge({
  score,
  label,
  caption,
  emoji,
  size = 168,
  animate = true,
}: Props) {
  const [shown, setShown] = useState(animate ? 0 : score);

  useEffect(() => {
    if (!animate) {
      setShown(score);
      return;
    }
    const start = performance.now();
    const duration = 1100;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(eased * score));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score, animate]);

  const stroke = 13;
  const r = (size - stroke) / 2 - 3;
  const c = 2 * Math.PI * r;
  const dash = (shown / 100) * c;
  const color = scoreColor(shown);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="#fffdf7"
            stroke="#1c1a17"
            strokeWidth={stroke + 6}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(28,26,23,0.12)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-display font-extrabold" style={{ color }}>
            {shown}
          </span>
          <span className="text-xl leading-none">{emoji}</span>
        </div>
      </div>
      <div className="text-center">
        <div className="font-display font-extrabold text-lg leading-tight">{label}</div>
        <div className="text-sm text-ink-soft font-medium">{caption}</div>
      </div>
    </div>
  );
}
