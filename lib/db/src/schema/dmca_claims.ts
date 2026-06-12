import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const dmcaClaimsTable = pgTable("dmca_claims", {
  id: serial("id").primaryKey(),
  claimantName: text("claimant_name").notNull(),
  claimantEmail: text("claimant_email").notNull(),
  claimantCompany: text("claimant_company"),
  copyrightOwner: text("copyright_owner").notNull(),
  workDescription: text("work_description").notNull(),
  infringingUrl: text("infringing_url").notNull(),
  goodFaithStatement: boolean("good_faith_statement").notNull().default(false),
  accuracyStatement: boolean("accuracy_statement").notNull().default(false),
  signature: text("signature").notNull(),
  status: text("status").notNull().default("received"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type DmcaClaim = typeof dmcaClaimsTable.$inferSelect;
export type InsertDmcaClaim = typeof dmcaClaimsTable.$inferInsert;
