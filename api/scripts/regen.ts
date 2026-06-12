import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { ratings } from "../src/db/schema";
import { generateRating } from "../src/lib/rate";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const rows = await db.select({ slug: ratings.slug, url: ratings.url }).from(ratings);
console.log(`regenerating ${rows.length} ratings…`);

const CONCURRENCY = 3;
let i = 0;
let done = 0;

async function worker() {
  while (i < rows.length) {
    const idx = i++;
    const { url } = rows[idx]!;
    try {
      const { row } = await generateRating(url);
      await db
        .update(ratings)
        .set({
          title: row.title,
          summary: row.summary,
          pricingScore: row.pricingScore,
          agentScore: row.agentScore,
          tree: row.tree,
          breakdown: row.breakdown,
          source: row.source,
          model: row.model,
          fetchOk: row.fetchOk,
          parseNotes: row.parseNotes,
          updatedAt: new Date(),
        })
        .where(eq(ratings.slug, row.slug));
      console.log(`✓ ${++done}/${rows.length} ${row.title} pricing=${row.pricingScore} agent=${row.agentScore} (${url})`);
    } catch (err) {
      console.error(`✗ ${++done}/${rows.length} ${url}:`, err instanceof Error ? err.message : err);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log("REGEN_DONE");
await pool.end();
