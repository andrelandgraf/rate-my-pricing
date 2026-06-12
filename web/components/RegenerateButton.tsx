"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { rateUrl } from "@/lib/api";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function RegenerateButton({
  url,
  updatedAt,
}: {
  url: string;
  updatedAt: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const age = now - new Date(updatedAt).getTime();
  const ready = age >= DAY_MS;
  const hoursLeft = Math.ceil((DAY_MS - age) / (60 * 60 * 1000));

  async function regenerate() {
    if (!ready || loading) return;
    setLoading(true);
    try {
      await rateUrl(url);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={regenerate}
      disabled={!ready || loading}
      title={ready ? "Re-run the agent" : `Saved tokens — refresh in ~${hoursLeft}h`}
      className="btn-pop bg-lime text-ink px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? "Re-rating…" : ready ? "🔄 Regenerate" : `🔒 Refresh in ~${hoursLeft}h`}
    </button>
  );
}
