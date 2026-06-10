import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const editorPicksTable = pgTable("editor_picks", {
  id: serial("id").primaryKey(),
  contentType: text("content_type").notNull(), // song | video | artist
  contentId: integer("content_id").notNull(),
  editorId: integer("editor_id").references(() => usersTable.id, { onDelete: "set null" }),
  note: text("note"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEditorPickSchema = createInsertSchema(editorPicksTable).omit({ id: true, createdAt: true });
export type InsertEditorPick = z.infer<typeof insertEditorPickSchema>;
export type EditorPick = typeof editorPicksTable.$inferSelect;
