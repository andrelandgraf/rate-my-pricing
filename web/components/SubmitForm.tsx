"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rateUrl, RateError } from "@/lib/api";

const STEPS = [
  "Knocking on the door 🚪",
  "Trying to curl the page 🌀",
  "Sniffing for markdown 🐕",
  "Falling back to HTML soup 🍜",
  "Reading the fine print 🔍",
  "Counting the tiers 🪜",
  "Hunting hidden fees 🕵️",
  "Untangling the pricing tree 🌳",
  "Doing the math 🧮",
  "Handing out scores 🏅",
];

export default function SubmitForm({
  autofocus = false,
  onQueryChange,
  initialValue = "",
}: {
  autofocus?: boolean;
  onQueryChange?: (query: string) => void;
  initialValue?: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autofocus) inputRef.current?.focus();
  }, [autofocus]);

  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2600);
    return () => clearInterval(id);
  }, [loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await rateUrl(url.trim());
      router.push(`/${res.rating.slug}`);
    } catch (err) {
      setError(
        err instanceof RateError
          ? err.message
          : "The agent tripped over that one. Try another page?",
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 bg-[#fffdf7] ink-border rounded-2xl px-4 py-3 shadow-[var(--shadow)]">
          <span className="text-xl select-none">🔗</span>
          <input
            ref={inputRef}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              onQueryChange?.(e.target.value);
            }}
            disabled={loading}
            placeholder="paste a url to rate — or type to filter…"
            className="w-full bg-transparent outline-none text-lg font-medium placeholder:text-ink-soft/60 font-mono"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-pop bg-coral text-ink px-7 py-3 text-lg whitespace-nowrap disabled:opacity-70"
        >
          {loading ? "Rating…" : "Rate it! ✨"}
        </button>
      </div>

      {loading && (
        <div className="mt-5 card p-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-wobble inline-block">🤖</span>
            <div className="flex-1">
              <div className="font-display font-bold text-lg">{STEPS[step]}</div>
              <div className="text-sm text-ink-soft">
                Agents read carefully — this can take up to a minute.
              </div>
            </div>
          </div>
          <div className="mt-4 h-3 ink-border rounded-full overflow-hidden bg-paper-2">
            <div className="h-full bg-grape animate-marquee w-[200%] bg-[length:24px_24px] bg-[linear-gradient(45deg,rgba(255,255,255,0.35)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.35)_50%,rgba(255,255,255,0.35)_75%,transparent_75%)]" />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 card p-4 bg-bubble/40 font-semibold flex items-center gap-2">
          <span className="text-xl">😬</span> {error}
        </div>
      )}
    </form>
  );
}
