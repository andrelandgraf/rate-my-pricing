"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

/** Fires a celebratory confetti burst once on mount. Used for perfect 100/100 scores. */
export default function Confetti() {
  useEffect(() => {
    const colors = ["#ff5d57", "#ffb22e", "#7bd640", "#4cc9f0", "#9b5de5", "#ff8fab"];
    const end = Date.now() + 1400;

    confetti({ particleCount: 140, spread: 90, origin: { y: 0.4 }, colors, scalar: 1.1 });

    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  return null;
}
