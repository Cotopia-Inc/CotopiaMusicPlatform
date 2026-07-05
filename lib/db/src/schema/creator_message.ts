import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const creatorMessageTable = pgTable("creator_message", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  authorTitle: text("author_title").notNull().default("Creator"),
  isVisible: boolean("is_visible").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCreatorMessageSchema = createInsertSchema(creatorMessageTable).omit({ id: true, userId: true, updatedAt: true });
export type InsertCreatorMessage = z.infer<typeof insertCreatorMessageSchema>;
export type CreatorMessage = typeof creatorMessageTable.$inferSelect;
