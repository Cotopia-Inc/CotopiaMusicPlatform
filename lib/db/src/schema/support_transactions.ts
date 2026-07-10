import { pgTable, text, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Records a single "support this creator" tip. This is the Creator Support
// system's demo transaction / support-activity ledger — each row is both the
// support activity entry and the demo transaction record (support message is
// stored inline since it's always 1:1 with a tip).
//
// `contentType` is intentionally an open text column (not a DB enum) so new
// content types (podcasts, radio shows, live streams, playlists, events...)
// can support tipping later without a migration — only the Zod input schema
// in the OpenAPI spec needs to add the new enum value.
export const supportTransactionsTable = pgTable("support_transactions", {
  id: serial("id").primaryKey(),
  supporterUserId: integer("supporter_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  recipientUserId: integer("recipient_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(), // song | video | artist | label (future: podcast, playlist, event, ...)
  contentId: integer("content_id"),
  amount: text("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  message: text("message"),
  transactionRef: text("transaction_ref").notNull(), // e.g. SUP-DEMO-458291
  provider: text("provider").notNull().default("paypal"),
  mode: text("mode").notNull().default("demo"), // demo | live (live unused until real payments are enabled)
  status: text("status").notNull().default("completed"), // completed | failed | refunded
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("support_transactions_ref_unique").on(table.transactionRef),
]);

export const insertSupportTransactionSchema = createInsertSchema(supportTransactionsTable).omit({ id: true, createdAt: true });
export type InsertSupportTransaction = z.infer<typeof insertSupportTransactionSchema>;
export type SupportTransaction = typeof supportTransactionsTable.$inferSelect;
