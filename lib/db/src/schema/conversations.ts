import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  participant1Id: integer("participant1_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  participant2Id: integer("participant2_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
