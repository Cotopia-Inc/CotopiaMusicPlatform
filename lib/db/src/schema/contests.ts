import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const contestsTable = pgTable("contests", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  rules: text("rules"),
  prizeDescription: text("prize_description"),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  status: text("status").notNull().default("inactive"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contestEntriesTable = pgTable("contest_entries", {
  id: serial("id").primaryKey(),
  contestId: integer("contest_id").notNull().references(() => contestsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  contentId: integer("content_id").notNull(),
  entryStatus: text("entry_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Contest = typeof contestsTable.$inferSelect;
export type ContestEntry = typeof contestEntriesTable.$inferSelect;
