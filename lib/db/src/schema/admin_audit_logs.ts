import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const adminAuditLogsTable = pgTable("admin_audit_logs", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: integer("target_id"),
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLogsTable.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLogsTable.$inferInsert;
