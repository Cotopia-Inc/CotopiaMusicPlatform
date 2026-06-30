import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const badgesTable = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("achievement"),
  icon: text("icon").notNull().default("🏆"),
  color: text("color").notNull().default("#7c3aed"),
  isVisible: boolean("is_visible").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export const userBadgesTable = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  badgeId: integer("badge_id").notNull().references(() => badgesTable.id, { onDelete: "cascade" }),
  awardedByAdminId: integer("awarded_by_admin_id").references(() => usersTable.id, { onDelete: "set null" }),
  reason: text("reason"),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Badge = typeof badgesTable.$inferSelect;
export type InsertBadge = typeof badgesTable.$inferInsert;
export type UserBadge = typeof userBadgesTable.$inferSelect;
export type InsertUserBadge = typeof userBadgesTable.$inferInsert;
