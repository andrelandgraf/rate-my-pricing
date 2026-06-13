import type { Rating, RateResponse, SortKey } from "./types";
import { getLeaderboard, getRating } from "./db";

// The agent (rating generation) still lives on the Neon Function. Reads now go straight to
// Postgres (see ./db), so the leaderboard/detail pages stay up even when the agent is down.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://br-rough-smoke-w2hoayam-ratemypricing.compute.c-1.us-east-2.aws.neon.build";

/**
 * Server-side: leaderboard rows from Postgres, filtered by category. Returns `null` only if the
 * database itself is unreachable (so the UI can show a maintenance state instead of a misleading
 * "empty leaderboard"); an empty array means genuinely no entries.
 */
export async function fetchLeaderboard(sort: SortKey, category: string, limit = 100) {
  try {
    return await getLeaderboard(sort, category, limit);
  } catch {
    return null;
  }
}

/**
 * Server-side: a single rating by slug from Postgres. Returns the rating, `null` when it genuinely
 * doesn't exist, or `"unreachable"` when the database is down.
 */
export async function fetchRating(
  slug: string,
  opts: { incrementViews?: boolean } = {},
): Promise<Rating | "unreachable" | null> {
  try {
    return await getRating(slug, opts);
  } catch {
    return "unreachable";
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
    // Network-level failure: the agent (Neon Function) is unreachable / paused.
    throw new RateError(
      "agent_paused",
      "The rating agent is paused right now — please hold tight and try again shortly. 🤖💤",
    );
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    // 5xx/502 from the function = agent down — show the friendly "paused" message.
    if (res.status >= 500) {
      throw new RateError(
        "agent_paused",
        "The rating agent is paused right now — please hold tight and try again shortly. 🤖💤",
      );
    }
    throw new RateError(err?.error ?? "request_failed", err?.message ?? defaultMessage(res.status));
  }
  return (await res.json()) as RateResponse;
}

function defaultMessage(status: number): string {
  if (status === 429) return "Too many ratings right now — try again in a little while.";
  if (status >= 500) return "The agent tripped over that one. Try another page?";
  return "Something went wrong. Try another page?";
}
