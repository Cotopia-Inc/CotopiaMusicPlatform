import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const copyrightConcernsTable = pgTable("copyright_concerns", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  contentType: text("content_type"),
  contentId: integer("content_id"),
  contentTitle: text("content_title"),
  concern: text("concern").notNull(),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  strikeId: integer("strike_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CopyrightConcern = typeof copyrightConcernsTable.$inferSelect;
export type InsertCopyrightConcern = typeof copyrightConcernsTable.$inferInsert;
