import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const labelsTable = pgTable("labels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bio: text("bio"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  website: text("website"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLabelSchema = createInsertSchema(labelsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLabel = z.infer<typeof insertLabelSchema>;
export type Label = typeof labelsTable.$inferSelect;
