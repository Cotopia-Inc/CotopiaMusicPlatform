import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const experienceFeedbackTable = pgTable("experience_feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  rating: integer("rating").notNull(),
  whatWorkedWell: text("what_worked_well"),
  whatWasConfusing: text("what_was_confusing"),
  didAnythingBreak: text("did_anything_break"),
  wouldRecommend: boolean("would_recommend"),
  trigger: text("trigger").notNull().default("general"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ExperienceFeedback = typeof experienceFeedbackTable.$inferSelect;
export type InsertExperienceFeedback = typeof experienceFeedbackTable.$inferInsert;
