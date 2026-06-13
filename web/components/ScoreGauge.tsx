"use client";

import { useEffect, useState } from "react";
import { scoreColor } from "@/lib/format";

type Props = {
  score: number;
  label: string;
  caption: string;
  emoji: string;
  animate?: boolean;
};

// Drawn in a 200x200 viewBox so the SVG scales fluidly to its (responsive) container.
const STROKE = 16;
const R = 84;
const C = 2 * Math.PI * R;

export default function ScoreGauge({ score, label, caption, emoji, animate = true }: Props) {
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

  const dash = (shown / 100) * C;
  const color = scoreColor(shown);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-[132px] h-[132px] sm:w-[168px] sm:h-[168px]">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          <circle cx="100" cy="100" r={R} fill="#fffdf7" stroke="#1c1a17" strokeWidth={STROKE + 6} />
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(28,26,23,0.12)" strokeWidth={STROKE} />
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl sm:text-4xl font-display font-extrabold" style={{ color }}>
            {shown}
          </span>
          <span className="text-lg sm:text-xl leading-none">{emoji}</span>
        </div>
      </div>
      <div className="text-center">
        <div className="font-display font-extrabold text-base sm:text-lg leading-tight">{label}</div>
        <div className="text-xs sm:text-sm text-ink-soft font-medium">{caption}</div>
      </div>
    </div>
  );
}
