import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const agreementAcceptancesTable = pgTable("agreement_acceptances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  agreementType: text("agreement_type").notNull(),
  agreementVersion: text("agreement_version").notNull().default("1.0"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
  submissionId: integer("submission_id"),
  paymentId: integer("payment_id"),
  metadata: jsonb("metadata"),
});

export type AgreementAcceptance = typeof agreementAcceptancesTable.$inferSelect;
export type InsertAgreementAcceptance = typeof agreementAcceptancesTable.$inferInsert;
