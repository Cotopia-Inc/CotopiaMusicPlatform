import { pgTable, serial, timestamp, integer, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const historyTable = pgTable("history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(), // song | video
  contentId: integer("content_id").notNull(),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHistorySchema = createInsertSchema(historyTable).omit({ id: true, playedAt: true });
export type InsertHistory = z.infer<typeof insertHistorySchema>;
export type History = typeof historyTable.$inferSelect;
