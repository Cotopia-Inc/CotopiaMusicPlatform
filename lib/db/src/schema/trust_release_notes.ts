import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const trustReleaseNotesTable = pgTable("trust_release_notes", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  releaseDate: timestamp("release_date", { withTimezone: true }).defaultNow().notNull(),
  summary: text("summary").notNull(),
  newFeatures: text("new_features"),
  improvements: text("improvements"),
  bugFixes: text("bug_fixes"),
  policyUpdates: text("policy_updates"),
  knownLimitations: text("known_limitations"),
  status: text("status").notNull().default("draft"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type TrustReleaseNote = typeof trustReleaseNotesTable.$inferSelect;
export type InsertTrustReleaseNote = typeof trustReleaseNotesTable.$inferInsert;
