import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { desc, asc, eq, sql } from "drizzle-orm";
import { parseEnv } from "@neondatabase/env/v1";
import config from "../neon";
import { ratings } from "./db/schema";
import { generateRating } from "./lib/rate";
import { normalizeUrl, slugFromUrl } from "./lib/slug";

const env = parseEnv(config);
const pool = new Pool({ connectionString: env.postgres.databaseUrl, max: 5 });
const db = drizzle(pool);

const REGEN_AFTER_MS = 24 * 60 * 60 * 1000; // 1 day

const app = new Hono();

app.use("*", cors());

app.get("/", (c) => c.json({ service: "rate-my-pricing", status: "ok" }));

const SORTS = {
  worst: asc(ratings.pricingScore),
  best: desc(ratings.pricingScore),
  agent: desc(ratings.agentScore),
  recent: desc(ratings.createdAt),
} as const;

type SortKey = keyof typeof SORTS;

app.get("/ratings", async (c) => {
  const sortParam = c.req.query("sort");
  const sort: SortKey = sortParam && sortParam in SORTS ? (sortParam as SortKey) : "recent";
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);

  const rows = await db
    .select({
      slug: ratings.slug,
      url: ratings.url,
      title: ratings.title,
      summary: ratings.summary,
      pricingScore: ratings.pricingScore,
      agentScore: ratings.agentScore,
      source: ratings.source,
      createdAt: ratings.createdAt,
    })
    .from(ratings)
    .orderBy(SORTS[sort])
    .limit(limit);

  return c.json({ sort, ratings: rows });
});

app.get("/ratings/:slug", async (c) => {
  const slug = c.req.param("slug");
  const [row] = await db.select().from(ratings).where(eq(ratings.slug, slug)).limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);

  await db
    .update(ratings)
    .set({ views: sql`${ratings.views} + 1` })
    .where(eq(ratings.slug, slug));

  return c.json(row);
});

app.post("/rate", async (c) => {
  let body: { url?: string; force?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (!body.url || typeof body.url !== "string") {
    return c.json({ error: "missing_url" }, 400);
  }

  let normalized: string;
  let slug: string;
  try {
    normalized = normalizeUrl(body.url);
    slug = slugFromUrl(normalized);
  } catch {
    return c.json({ error: "invalid_url" }, 400);
  }

  const [existing] = await db.select().from(ratings).where(eq(ratings.slug, slug)).limit(1);
  const age = existing ? Date.now() - new Date(existing.updatedAt).getTime() : Infinity;

  if (existing && !body.force && age < REGEN_AFTER_MS) {
    return c.json({ cached: true, rating: existing });
  }

  const { row } = await generateRating(normalized);

  const [saved] = await db
    .insert(ratings)
    .values(row)
    .onConflictDoUpdate({
      target: ratings.slug,
      set: {
        url: row.url,
        title: row.title,
        summary: row.summary,
        pricingScore: row.pricingScore,
        agentScore: row.agentScore,
        tree: row.tree,
        source: row.source,
        model: row.model,
        fetchOk: row.fetchOk,
        parseNotes: row.parseNotes,
        updatedAt: new Date(),
      },
    })
    .returning();

  return c.json({ cached: false, rating: saved });
});

process.on("SIGINT", () => {
  pool.end().then(() => process.exit(0));
});

export default app;
