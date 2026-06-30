import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const bugReportsTable = pgTable("bug_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userEmail: text("user_email"),
  whatHappened: text("what_happened").notNull(),
  pageUrl: text("page_url"),
  whatTrying: text("what_trying"),
  deviceBrowser: text("device_browser"),
  severity: text("severity").notNull().default("medium"),
  status: text("status").notNull().default("new"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type BugReport = typeof bugReportsTable.$inferSelect;
export type InsertBugReport = typeof bugReportsTable.$inferInsert;
