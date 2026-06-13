import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { ratings, ratingHistory } from "../src/db/schema";
import { generateRating } from "../src/lib/rate";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const WEB_URL = (process.env.WEB_URL ?? "").replace(/\/+$/, "");
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET ?? "";

// Only regenerate the entries shown on the leaderboard.
const onlyListed = process.argv.includes("--all") ? undefined : eq(ratings.listed, true);
const rows = await db
  .select({ slug: ratings.slug, url: ratings.url })
  .from(ratings)
  .where(onlyListed);
console.log(`regenerating ${rows.length} ratings with the hardened chain…`);

async function revalidate(slug: string) {
  if (!WEB_URL || !REVALIDATE_SECRET) return;
  try {
    await fetch(`${WEB_URL}/api/revalidate?slug=${encodeURIComponent(slug)}&secret=${REVALIDATE_SECRET}`);
  } catch (err) {
    console.error(`  revalidate ${slug} failed:`, err instanceof Error ? err.message : err);
  }
}

const CONCURRENCY = 3;
let i = 0;
let done = 0;

async function worker() {
  while (i < rows.length) {
    const idx = i++;
    const existing = rows[idx]!;
    try {
      const { row } = await generateRating(existing.url);
      await db
        .update(ratings)
        .set({
          host: row.host,
          url: row.url,
          title: row.title,
          category: row.category,
          summary: row.summary,
          pricingScore: row.pricingScore,
          agentScore: row.agentScore,
          tree: row.tree,
          breakdown: row.breakdown,
          rawExtraction: row.rawExtraction,
          source: row.source,
          model: row.model,
          fetchOk: row.fetchOk,
          parseNotes: row.parseNotes,
          updatedAt: new Date(),
        })
        .where(eq(ratings.slug, existing.slug));
      await db.insert(ratingHistory).values({
        slug: existing.slug,
        host: row.host,
        url: row.url,
        title: row.title,
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
      });
      await revalidate(existing.slug);
      console.log(
        `✓ ${++done}/${rows.length} ${row.title} pricing=${row.pricingScore} agent=${row.agentScore} (${existing.slug})`,
      );
    } catch (err) {
      console.error(`✗ ${++done}/${rows.length} ${existing.url}:`, err instanceof Error ? err.message : err);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log("REGEN_DONE");
await pool.end();
