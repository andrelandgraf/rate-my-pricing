import type { Rating, RatingSummary, RateResponse, SortKey } from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://br-rough-smoke-w2hoayam-ratemypricing.compute.c-1.us-east-2.aws.neon.build";

/** Server-side: fetch the leaderboard. Never cached so new submissions show up. */
export async function fetchLeaderboard(sort: SortKey, limit = 60): Promise<RatingSummary[]> {
  try {
    const res = await fetch(`${API_URL}/ratings?sort=${sort}&limit=${limit}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { ratings: RatingSummary[] };
    return data.ratings ?? [];
  } catch {
    return [];
  }
}

/** Server-side: fetch a single rating by slug. */
export async function fetchRating(slug: string): Promise<Rating | null> {
  try {
    const res = await fetch(`${API_URL}/ratings/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Rating;
  } catch {
    return null;
  }
}

export class RateError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "RateError";
  }
}

/** Client-side: kick off (or fetch cached) a rating for a URL. Long-running. */
export async function rateUrl(url: string, force = false): Promise<RateResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/rate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, force }),
    });
  } catch {
    // Network-level failure (connection dropped, offline, CORS, etc.).
    throw new RateError("network", "Couldn't reach the agent. Check your connection and try again.");
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new RateError(err?.error ?? "request_failed", err?.message ?? defaultMessage(res.status));
  }
  return (await res.json()) as RateResponse;
}

function defaultMessage(status: number): string {
  if (status === 429) return "Too many ratings right now — try again in a little while.";
  if (status >= 500) return "The agent tripped over that one. Try another page?";
  return "Something went wrong. Try another page?";
}
