import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const trustAppealsTable = pgTable("trust_appeals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  submitterEmail: text("submitter_email"),
  submitterName: text("submitter_name"),
  actionType: text("action_type").notNull(),
  relatedContent: text("related_content"),
  reason: text("reason").notNull(),
  supportingInfo: text("supporting_info"),
  status: text("status").notNull().default("received"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type TrustAppeal = typeof trustAppealsTable.$inferSelect;
export type InsertTrustAppeal = typeof trustAppealsTable.$inferInsert;
