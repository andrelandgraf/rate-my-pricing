import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import type { PricingTree } from "../lib/types";

export const ratings = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    pricingScore: integer("pricing_score").notNull(),
    agentScore: integer("agent_score").notNull(),
    tree: jsonb("tree").$type<PricingTree>().notNull(),
    source: text("source").notNull(),
    model: text("model").notNull().default(""),
    fetchOk: boolean("fetch_ok").notNull().default(true),
    parseNotes: text("parse_notes").notNull().default(""),
    views: integer("views").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pricingScoreIdx: index("ratings_pricing_score_idx").on(table.pricingScore),
    agentScoreIdx: index("ratings_agent_score_idx").on(table.agentScore),
    createdAtIdx: index("ratings_created_at_idx").on(table.createdAt),
  }),
);

export type RatingRow = typeof ratings.$inferSelect;
export type NewRatingRow = typeof ratings.$inferInsert;
