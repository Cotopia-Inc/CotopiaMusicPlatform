import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const trustKnownIssuesTable = pgTable("trust_known_issues", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("investigating"),
  affectedArea: text("affected_area"),
  workaround: text("workaround"),
  isPublic: boolean("is_public").notNull().default(false),
  dateReported: timestamp("date_reported", { withTimezone: true }).defaultNow().notNull(),
  resolutionDate: timestamp("resolution_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type TrustKnownIssue = typeof trustKnownIssuesTable.$inferSelect;
export type InsertTrustKnownIssue = typeof trustKnownIssuesTable.$inferInsert;
