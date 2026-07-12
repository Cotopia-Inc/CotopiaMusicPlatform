import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const trustTimelineTable = pgTable("trust_timeline", {
  id: serial("id").primaryKey(),
  eventDate: timestamp("event_date", { withTimezone: true }).defaultNow().notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("Product"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type TrustTimeline = typeof trustTimelineTable.$inferSelect;
export type InsertTrustTimeline = typeof trustTimelineTable.$inferInsert;
