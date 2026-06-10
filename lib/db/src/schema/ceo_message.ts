import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ceoMessageTable = pgTable("ceo_message", {
  id: serial("id").primaryKey(),
  content: text("content").notNull().default(""),
  authorName: text("author_name").notNull().default("CEO"),
  authorTitle: text("author_title").notNull().default("Chief Executive Officer"),
  isVisible: boolean("is_visible").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  updatedBy: integer("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
});

export const insertCeoMessageSchema = createInsertSchema(ceoMessageTable).omit({ id: true, updatedAt: true });
export type InsertCeoMessage = z.infer<typeof insertCeoMessageSchema>;
export type CeoMessage = typeof ceoMessageTable.$inferSelect;
