import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const companyPostsTable = pgTable("company_posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").references(() => usersTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  type: text("type").notNull().default("announcement"), // announcement | video | product_update | artist_spotlight | label_spotlight | campaign
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  isPinned: boolean("is_pinned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCompanyPostSchema = createInsertSchema(companyPostsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompanyPost = z.infer<typeof insertCompanyPostSchema>;
export type CompanyPost = typeof companyPostsTable.$inferSelect;
