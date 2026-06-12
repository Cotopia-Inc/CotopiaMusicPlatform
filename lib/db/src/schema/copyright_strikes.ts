import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const copyrightStrikesTable = pgTable("copyright_strikes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  contentId: integer("content_id").notNull(),
  dmcaClaimId: integer("dmca_claim_id"),
  strikeReason: text("strike_reason").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export type CopyrightStrike = typeof copyrightStrikesTable.$inferSelect;
export type InsertCopyrightStrike = typeof copyrightStrikesTable.$inferInsert;
