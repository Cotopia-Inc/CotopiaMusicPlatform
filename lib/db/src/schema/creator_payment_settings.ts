import { pgTable, text, serial, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Per-creator payment configuration for the Creator Support (tip) system.
// One row per user. `provider` is a free-text column so future payment
// providers (Stripe, Venmo, etc.) can be added without a schema change —
// each provider just interprets its own subset of the columns (or future
// provider-specific columns can be added alongside paypalEmail/paypalMeLink).
export const creatorPaymentSettingsTable = pgTable("creator_payment_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  supportEnabled: boolean("support_enabled").notNull().default(false),
  provider: text("provider").notNull().default("paypal"), // paypal | (future: stripe, venmo, ...)
  paypalEmail: text("paypal_email"),
  paypalMeLink: text("paypal_me_link"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  unique("creator_payment_settings_user_unique").on(table.userId),
]);

export const insertCreatorPaymentSettingsSchema = createInsertSchema(creatorPaymentSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCreatorPaymentSettings = z.infer<typeof insertCreatorPaymentSettingsSchema>;
export type CreatorPaymentSettings = typeof creatorPaymentSettingsTable.$inferSelect;
