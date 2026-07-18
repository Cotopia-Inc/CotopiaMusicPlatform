import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { submissionsTable } from "./submissions";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  submissionId: integer("submission_id").references(() => submissionsTable.id, { onDelete: "set null" }),

  // Payment provider: "demo" | "paypal_sandbox" | "paypal_live"
  provider: text("provider").notNull().default("demo"),
  // Payment mode at the time of the transaction (matches app_settings.payment_mode)
  paymentMode: text("payment_mode").notNull().default("demo"),
  // True for all demo and sandbox transactions that involve no real money
  isDemo: boolean("is_demo").notNull().default(true),

  // Provider transaction identifiers
  paypalOrderId: text("paypal_order_id"),
  externalTransactionId: text("external_transaction_id"),
  // Human-readable confirmation number shown to users in demo mode
  demoConfirmationNumber: text("demo_confirmation_number"),

  amount: text("amount").notNull(),
  currency: text("currency").notNull().default("USD"),

  // Normalized status: initiated | completed | failed | refunded | disputed | canceled
  status: text("status").notNull().default("initiated"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
