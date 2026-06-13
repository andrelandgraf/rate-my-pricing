import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { PricingTree } from "../lib/types";
import type { Breakdown } from "../lib/score";

export const ratings = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    host: text("host").notNull().default(""),
    url: text("url").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    pricingScore: integer("pricing_score").notNull(),
    agentScore: integer("agent_score").notNull(),
    tree: jsonb("tree").$type<PricingTree>().notNull(),
    breakdown: jsonb("breakdown").$type<Breakdown>(),
    source: text("source").notNull(),
    model: text("model").notNull().default(""),
    fetchOk: boolean("fetch_ok").notNull().default(true),
    // Pages with no concrete pricing are still cached + viewable by direct link, but hidden
    // from the leaderboard.
    listed: boolean("listed").notNull().default(true),
    parseNotes: text("parse_notes").notNull().default(""),
    views: integer("views").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    hostIdx: index("ratings_host_idx").on(table.host),
    listedIdx: index("ratings_listed_idx").on(table.listed),
    pricingScoreIdx: index("ratings_pricing_score_idx").on(table.pricingScore),
    agentScoreIdx: index("ratings_agent_score_idx").on(table.agentScore),
    createdAtIdx: index("ratings_created_at_idx").on(table.createdAt),
  }),
);

export type RatingRow = typeof ratings.$inferSelect;
export type NewRatingRow = typeof ratings.$inferInsert;

/**
 * Append-only snapshot of every agent (re)generation, so scores can be charted over time
 * and regressions/improvements tracked. `ratings` holds the latest; this holds the history.
 */
export const ratingHistory = pgTable(
  "rating_history",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    host: text("host").notNull().default(""),
    url: text("url").notNull(),
    title: text("title").notNull().default(""),
    pricingScore: integer("pricing_score").notNull(),
    agentScore: integer("agent_score").notNull(),
    tree: jsonb("tree").$type<PricingTree>(),
    breakdown: jsonb("breakdown").$type<Breakdown>(),
    source: text("source").notNull().default(""),
    model: text("model").notNull().default(""),
    fetchOk: boolean("fetch_ok").notNull().default(true),
    listed: boolean("listed").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugCreatedIdx: index("rating_history_slug_created_idx").on(table.slug, table.createdAt),
  }),
);

export type RatingHistoryRow = typeof ratingHistory.$inferSelect;
export type NewRatingHistoryRow = typeof ratingHistory.$inferInsert;

/** Fixed-window counters for rate limiting expensive (token-burning) generations. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    id: serial("id").primaryKey(),
    bucket: text("bucket").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => ({
    bucketWindowIdx: uniqueIndex("rate_limits_bucket_window_idx").on(
      table.bucket,
      table.windowStart,
    ),
  }),
);
