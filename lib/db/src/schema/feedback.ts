import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Beta feedback center submissions
export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  userRole: text("user_role").notNull(), // captured at submission time
  type: text("type").notNull(), // bug | feature | general
  title: text("title").notNull(),
  description: text("description").notNull(),
  screenshotUrl: text("screenshot_url"),
  status: text("status").notNull().default("open"), // open | in_progress | resolved | closed
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Feedback = typeof feedbackTable.$inferSelect;
export type InsertFeedback = typeof feedbackTable.$inferInsert;
