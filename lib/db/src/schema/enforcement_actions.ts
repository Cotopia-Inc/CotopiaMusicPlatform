import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Tiered community enforcement: warning | strike | suspension | ban
export const enforcementActionsTable = pgTable("enforcement_actions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(), // warning | strike | suspension | ban
  reason: text("reason").notNull(),
  notes: text("notes"),
  issuedByUserId: integer("issued_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  isAutomated: boolean("is_automated").notNull().default(false), // system-generated via auto-escalation
  status: text("status").notNull().default("active"), // active | lifted
  expiresAt: timestamp("expires_at", { withTimezone: true }), // for temporary suspension
  reportId: integer("report_id"), // optional link to originating report
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  liftedAt: timestamp("lifted_at", { withTimezone: true }),
});

export type EnforcementAction = typeof enforcementActionsTable.$inferSelect;
export type InsertEnforcementAction = typeof enforcementActionsTable.$inferInsert;
