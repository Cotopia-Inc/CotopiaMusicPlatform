import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const featureSuggestionsTable = pgTable("feature_suggestions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userEmail: text("user_email"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  why: text("why"),
  category: text("category").notNull().default("other"),
  priority: text("priority").notNull().default("nice_to_have"),
  status: text("status").notNull().default("new"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type FeatureSuggestion = typeof featureSuggestionsTable.$inferSelect;
export type InsertFeatureSuggestion = typeof featureSuggestionsTable.$inferInsert;
