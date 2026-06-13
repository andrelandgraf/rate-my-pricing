import { Sentry } from "./instrument";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { desc, asc, eq, and, sql } from "drizzle-orm";
import { CATEGORIES } from "./lib/types";
import { parseEnv } from "@neondatabase/env/v1";
import config from "../neon";
import { ratings, ratingHistory } from "./db/schema";
import { generateRating } from "./lib/rate";
import { normalizeUrl, hostFromUrl } from "./lib/slug";
import { assertSafeUrl, UnsafeUrlError } from "./lib/safeFetch";
import { hitRateLimit } from "./lib/ratelimit";
import type { Context } from "hono";

const env = parseEnv(config);
const pool = new Pool({ connectionString: env.postgres.databaseUrl, max: 5 });
const db = drizzle(pool);

const REGEN_AFTER_MS = 24 * 60 * 60 * 1000; // 1 day
const RATE_LIMIT_PER_IP = Number(process.env.RATE_LIMIT_PER_IP_PER_HOUR ?? 20);
const RATE_LIMIT_GLOBAL = Number(process.env.RATE_LIMIT_GLOBAL_PER_HOUR ?? 300);
const WEB_URL = (process.env.WEB_URL ?? "").replace(/\/+$/, "");
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET ?? "";

/**
 * Fire-and-forget: after a (re)generation, drop the page's cached social images (so a regen's
 * new scores take effect), then re-warm the exact og:image/twitter:image URLs so the first
 * crawler (X/Slack/etc.) gets a CDN-cached PNG instantly instead of a cold render.
 */
function refreshSocialImages(slug: string): void {
  if (!WEB_URL) return;
  void (async () => {
    try {
      // 1. Revalidate so the cached page + images are invalidated (reflect new scores).
      if (REVALIDATE_SECRET) {
        await fetch(
          `${WEB_URL}/api/revalidate?slug=${encodeURIComponent(slug)}&secret=${encodeURIComponent(REVALIDATE_SECRET)}`,
          { method: "POST" },
        ).catch(() => {});
      }
      // 2. Re-warm: fetch the page, extract the exact image URLs, and request them (fresh render).
      const res = await fetch(`${WEB_URL}/${slug}`, {
        headers: { "user-agent": "RateMyPricingPrewarm/1.0", "cache-control": "no-cache" },
      });
      const html = await res.text();
      const urls = new Set<string>();
      for (const m of html.matchAll(
        /<meta (?:property|name)="(?:og:image|twitter:image)"[^>]*content="([^"]+)"/g,
      )) {
        if (m[1]) urls.add(m[1].replace(/&amp;/g, "&"));
      }
      await Promise.all([...urls].map((u) => fetch(u).catch(() => {})));
      console.log(`[refresh] ${slug}: revalidated + warmed ${urls.size} social image(s)`);
    } catch (err) {
      console.error("[refresh] failed:", err instanceof Error ? err.message : err);
    }
  })();
}

/** Friendly reason for an unfetchable URL, by HTTP status. */
function unfetchableMessage(status: number): string {
  if (status === 404 || status === 410) return "That page wasn't found (404). Double-check the URL — does the pricing page live somewhere else?";
  if (status === 401 || status === 403) return "That page blocked our agent (it may require a login). Try a public pricing page.";
  if (status >= 500) return `That site returned an error (status ${status}). Try again in a bit.`;
  return "Couldn't reach that page. Check the URL and try again.";
}

function clientIp(c: Context): string {
  const xff = c.req.header("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return (
    first ||
    c.req.header("x-real-ip") ||
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-vercel-forwarded-for") ||
    "unknown"
  );
}

const app = new Hono();

app.use("*", cors());

// Report unhandled route errors to Sentry. cors() doesn't decorate error responses,
// so set the permissive header here too.
app.onError((err, c) => {
  Sentry.captureException(err);
  c.header("access-control-allow-origin", "*");
  return c.json({ error: "internal_error" }, 500);
});

app.get("/", (c) => c.json({ service: "rate-my-pricing", status: "ok" }));

const SORTS = {
  // Worst offenders: least clear pricing first, ties broken by worst agent-easiness.
  worst: [asc(ratings.pricingScore), asc(ratings.agentScore)],
  best: [desc(ratings.pricingScore), desc(ratings.agentScore)],
  // Best for agents: highest agent-easiness first, ties broken by pricing clarity.
  agent: [desc(ratings.agentScore), desc(ratings.pricingScore)],
  recent: [desc(ratings.createdAt)],
} as const;

type SortKey = keyof typeof SORTS;

app.get("/ratings", async (c) => {
  const sortParam = c.req.query("sort");
  const sort: SortKey = sortParam && sortParam in SORTS ? (sortParam as SortKey) : "recent";
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);

  const categoryParam = c.req.query("category");
  const where =
    categoryParam && categoryParam !== "all" && (CATEGORIES as readonly string[]).includes(categoryParam)
      ? and(eq(ratings.listed, true), eq(ratings.category, categoryParam))
      : eq(ratings.listed, true);

  const rows = await db
    .select({
      slug: ratings.slug,
      url: ratings.url,
      title: ratings.title,
      summary: ratings.summary,
      category: ratings.category,
      pricingScore: ratings.pricingScore,
      agentScore: ratings.agentScore,
      source: ratings.source,
      createdAt: ratings.createdAt,
    })
    .from(ratings)
    .where(where)
    .orderBy(...SORTS[sort])
    .limit(limit);

  return c.json({ sort, category: categoryParam ?? "all", ratings: rows });
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

app.get("/ratings/:slug/history", async (c) => {
  const slug = c.req.param("slug");
  const rows = await db
    .select({
      pricingScore: ratingHistory.pricingScore,
      agentScore: ratingHistory.agentScore,
      source: ratingHistory.source,
      model: ratingHistory.model,
      listed: ratingHistory.listed,
      createdAt: ratingHistory.createdAt,
    })
    .from(ratingHistory)
    .where(eq(ratingHistory.slug, slug))
    .orderBy(asc(ratingHistory.createdAt))
    .limit(500);
  return c.json({ slug, history: rows });
});

app.post("/rate", async (c) => {
  // Reject oversized bodies before reading them (a URL payload is tiny — cap memory/DoS surface).
  const contentLength = Number(c.req.header("content-length") ?? 0);
  if (contentLength > 4096) {
    return c.json({ error: "payload_too_large", message: "Request body too large." }, 413);
  }

  let body: { url?: string; force?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json", message: "Malformed request." }, 400);
  }

  if (!body.url || typeof body.url !== "string") {
    return c.json({ error: "missing_url", message: "Please provide a pricing page URL." }, 400);
  }

  if (body.url.length > 2048) {
    return c.json({ error: "invalid_url", message: "That URL is too long." }, 400);
  }

  let normalized: string;
  let host: string;
  try {
    normalized = normalizeUrl(body.url);
    host = hostFromUrl(normalized);
  } catch {
    return c.json({ error: "invalid_url", message: "That doesn't look like a valid URL." }, 400);
  }

  // SSRF guard: never let the agent fetch internal/private targets.
  try {
    await assertSafeUrl(normalized);
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return c.json(
        { error: "blocked_url", message: "That URL points somewhere we can't rate. Try a public pricing page." },
        400,
      );
    }
    throw err;
  }

  // One rating per host: any URL on a host maps to that host's canonical rating.
  const [existing] = await db
    .select()
    .from(ratings)
    .where(eq(ratings.host, host))
    .orderBy(asc(ratings.createdAt))
    .limit(1);
  const age = existing ? Date.now() - new Date(existing.updatedAt).getTime() : Infinity;

  // Cached results are always free — only fresh generations are rate limited.
  if (existing && !body.force && age < REGEN_AFTER_MS) {
    return c.json({ cached: true, rating: existing });
  }

  const ipHit = await hitRateLimit(db, `ip:${clientIp(c)}`, RATE_LIMIT_PER_IP);
  if (!ipHit.allowed) {
    c.header("retry-after", String(ipHit.retryAfterSeconds));
    return c.json(
      {
        error: "rate_limited",
        message: `You've hit the limit of ${RATE_LIMIT_PER_IP} new ratings per hour. Cached results are always free — try again later.`,
        retryAfterSeconds: ipHit.retryAfterSeconds,
      },
      429,
    );
  }
  const globalHit = await hitRateLimit(db, "global", RATE_LIMIT_GLOBAL);
  if (!globalHit.allowed) {
    c.header("retry-after", String(globalHit.retryAfterSeconds));
    return c.json(
      {
        error: "rate_limited",
        message: "The agent is swamped with new ratings right now. Try again in a bit.",
        retryAfterSeconds: globalHit.retryAfterSeconds,
      },
      429,
    );
  }

  const { row, fetchStatus } = await generateRating(normalized);

  // Guardrail: if we couldn't actually fetch the page (404/401/403/timeout), don't persist a
  // junk rating. Keep any existing good rating for the host; otherwise tell the user why.
  if (!row.fetchOk) {
    if (existing) return c.json({ cached: true, rating: existing });
    return c.json(
      { error: "unfetchable", status: fetchStatus, message: unfetchableMessage(fetchStatus) },
      422,
    );
  }

  const updatedFields = {
    host: row.host,
    url: row.url,
    title: row.title,
    summary: row.summary,
    category: row.category,
    pricingScore: row.pricingScore,
    agentScore: row.agentScore,
    tree: row.tree,
    breakdown: row.breakdown,
    rawExtraction: row.rawExtraction,
    source: row.source,
    model: row.model,
    fetchOk: row.fetchOk,
    listed: row.listed,
    parseNotes: row.parseNotes,
    updatedAt: new Date(),
  };

  let saved;
  if (existing) {
    // Update the host's canonical row in place — keep its slug so existing links stay valid.
    [saved] = await db
      .update(ratings)
      .set(updatedFields)
      .where(eq(ratings.id, existing.id))
      .returning();
  } else {
    [saved] = await db
      .insert(ratings)
      .values(row)
      .onConflictDoUpdate({ target: ratings.slug, set: updatedFields })
      .returning();
  }

  if (saved) {
    // Append-only history snapshot for time-series charts / regression tracking.
    await db.insert(ratingHistory).values({
      slug: saved.slug,
      host: saved.host,
      url: saved.url,
      title: saved.title,
      category: saved.category,
      pricingScore: saved.pricingScore,
      agentScore: saved.agentScore,
      tree: saved.tree,
      breakdown: saved.breakdown,
      rawExtraction: saved.rawExtraction,
      source: saved.source,
      model: saved.model,
      fetchOk: saved.fetchOk,
      listed: saved.listed,
    });
    refreshSocialImages(saved.slug);
  }

  return c.json({ cached: false, rating: saved });
});

process.on("SIGINT", () => {
  pool.end().then(() => process.exit(0));
});

export default app;
