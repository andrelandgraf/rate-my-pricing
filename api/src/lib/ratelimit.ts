import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { rateLimits } from "../db/schema";

export const WINDOW_MS = 60 * 60 * 1000; // 1 hour fixed window

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
};

function currentWindowStart(now = Date.now()): Date {
  return new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);
}

function secondsToNextWindow(now = Date.now()): number {
  return Math.ceil((Math.floor(now / WINDOW_MS) * WINDOW_MS + WINDOW_MS - now) / 1000);
}

/**
 * Atomically increment the counter for `bucket` in the current window and report
 * whether the caller is within `limit`. The incrementing attempt itself counts,
 * so sustained hammering stays blocked until the window rolls over.
 */
export async function hitRateLimit(
  db: NodePgDatabase,
  bucket: string,
  limit: number,
): Promise<RateLimitResult> {
  const windowStart = currentWindowStart();
  const [row] = await db
    .insert(rateLimits)
    .values({ bucket, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.bucket, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  const count = row?.count ?? 1;
  return {
    allowed: count <= limit,
    count,
    limit,
    retryAfterSeconds: secondsToNextWindow(),
  };
}
