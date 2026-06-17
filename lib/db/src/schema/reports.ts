import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Generic content/user report queue (separate from copyright concerns/DMCA).
export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(), // song | video | profile | comment | chat_message | private_message
  targetId: integer("target_id").notNull(),
  reason: text("reason").notNull(), // copyright | harassment | spam | fake_profile | illegal_content | other
  details: text("details"),
  status: text("status").notNull().default("pending"), // pending | reviewing | resolved | dismissed
  reviewedBy: integer("reviewed_by").references(() => usersTable.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Report = typeof reportsTable.$inferSelect;
export type InsertReport = typeof reportsTable.$inferInsert;
