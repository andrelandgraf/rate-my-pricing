export type ScoreTone = "great" | "ok" | "bad";

export function tone(score: number): ScoreTone {
  if (score >= 75) return "great";
  if (score >= 40) return "ok";
  return "bad";
}

export function toneColor(t: ScoreTone): string {
  return t === "great" ? "#16a34a" : t === "ok" ? "#f59e0b" : "#ef4444";
}

export function scoreColor(score: number): string {
  return toneColor(tone(score));
}

export function pricingLabel(score: number): string {
  if (score >= 90) return "Crystal clear";
  if (score >= 75) return "Easy to read";
  if (score >= 50) return "A bit fiddly";
  if (score >= 25) return "Pretty tangled";
  return "Total maze";
}

export function agentLabel(score: number): string {
  if (score >= 90) return "Breezy for bots";
  if (score >= 75) return "Agent-friendly";
  if (score >= 50) return "Some friction";
  if (score >= 25) return "Rough for bots";
  return "Bot nightmare";
}

export function billingLabel(model: string): string {
  const map: Record<string, string> = {
    flat: "Flat rate",
    tiered: "Tiered",
    usage: "Usage-based",
    "per-seat": "Per seat",
    hybrid: "Hybrid",
    unknown: "Unknown",
  };
  return map[model] ?? model;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
