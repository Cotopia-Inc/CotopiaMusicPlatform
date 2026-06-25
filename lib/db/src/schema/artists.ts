import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const artistsTable = pgTable("artists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  stageName: text("stage_name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  genre: text("genre"),
  labelId: integer("label_id"), // references labelsTable — set after both are created
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertArtistSchema = createInsertSchema(artistsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertArtist = z.infer<typeof insertArtistSchema>;
export type Artist = typeof artistsTable.$inferSelect;
