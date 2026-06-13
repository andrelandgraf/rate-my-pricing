"use client";

import { useState } from "react";
import { pricingLabel } from "@/lib/format";

export default function ShareButton({
  title,
  pricingScore,
  agentScore,
}: {
  title: string;
  pricingScore: number;
  agentScore: number;
}) {
  const [open, setOpen] = useState(false);

  function share() {
    const verdict = pricingLabel(pricingScore).toLowerCase();
    const text = `${title} pricing: 🧾 ${pricingScore}/100 clarity · 🤖 ${agentScore}/100 agent-easiness — ${verdict}.\n\nrated on Rate My Pricing 👇`;
    const url = typeof window !== "undefined" ? window.location.href : "";
    const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
    setOpen(true);
  }

  return (
    <button
      onClick={share}
      title="Share these scores on X"
      className="btn-pop bg-sky text-ink px-4 py-2 text-sm inline-flex items-center gap-1.5"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      {open ? "Shared!" : "Share on X"}
    </button>
  );
}
