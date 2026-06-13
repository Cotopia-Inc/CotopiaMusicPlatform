import { pgTable, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  participant1Id: integer("participant1_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  participant2Id: integer("participant2_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  mutedByP1: boolean("muted_by_p1").default(false).notNull(),
  mutedByP2: boolean("muted_by_p2").default(false).notNull(),
});
