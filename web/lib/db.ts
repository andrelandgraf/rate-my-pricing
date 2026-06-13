import { Pool } from "pg";
import type { Rating, RatingSummary, SortKey } from "./types";

// Reads now query Neon Postgres directly from Vercel (server-side only), so the leaderboard and
// detail pages stay up even when the agent (Neon Function) is unavailable. Writes/ratings still
// go through the Neon Function. Uses the POOLED connection string (Neon's pooler) and a cached
// module-level Pool so warm serverless instances reuse connections.
declare global {
  // eslint-disable-next-line no-var
  var __ratemypricingPool: Pool | undefined;
}

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  globalThis.__ratemypricingPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 10_000,
  });
  return globalThis.__ratemypricingPool;
}

// Fixed, non-user-controlled ORDER BY clauses (safe to inline).
const ORDER_BY: Record<SortKey, string> = {
  worst: "pricing_score ASC, agent_score ASC",
  best: "pricing_score DESC, agent_score DESC",
  agent: "agent_score DESC, pricing_score DESC",
  recent: "created_at DESC",
};

const VALID_CATEGORIES = new Set([
  "devtools",
  "paas",
  "hyperscaler",
  "ai-lab",
  "saas",
  "educational",
  "other",
]);

const iso = (d: unknown): string =>
  d instanceof Date ? d.toISOString() : typeof d === "string" ? d : new Date().toISOString();

export async function getLeaderboard(
  sort: SortKey,
  category: string,
  limit = 100,
): Promise<RatingSummary[]> {
  const orderBy = ORDER_BY[sort] ?? ORDER_BY.recent;
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  const useCategory = category && category !== "all" && VALID_CATEGORIES.has(category);

  const params: unknown[] = [];
  let where = "listed = true";
  if (useCategory) {
    params.push(category);
    where += ` AND category = $${params.length}`;
  }
  params.push(safeLimit);

  const { rows } = await getPool().query(
    `SELECT slug, url, title, summary, category, pricing_score AS "pricingScore",
            agent_score AS "agentScore", source, created_at AS "createdAt"
       FROM ratings
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length}`,
    params,
  );

  return rows.map((r) => ({ ...r, createdAt: iso(r.createdAt) })) as RatingSummary[];
}

export async function getRating(
  slug: string,
  opts: { incrementViews?: boolean } = {},
): Promise<Rating | null> {
  const { rows } = await getPool().query(
    `SELECT id, slug, url, title, summary, category, pricing_score AS "pricingScore",
            agent_score AS "agentScore", tree, breakdown, raw_extraction AS "rawExtraction",
            source, model, fetch_ok AS "fetchOk", listed, parse_notes AS "parseNotes",
            views, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM ratings WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  const row = rows[0];
  if (!row) return null;

  if (opts.incrementViews) {
    // Fire-and-forget; never block the page render on the counter.
    getPool()
      .query(`UPDATE ratings SET views = views + 1 WHERE slug = $1`, [slug])
      .catch(() => {});
  }

  return { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) } as Rating;
}
