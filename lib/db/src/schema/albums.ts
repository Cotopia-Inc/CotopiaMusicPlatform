import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { artistsTable } from "./artists";

export const albumsTable = pgTable("albums", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull().references(() => artistsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  coverUrl: text("cover_url"),
  genre: text("genre"),
  releaseDate: text("release_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAlbumSchema = createInsertSchema(albumsTable).omit({ id: true, createdAt: true });
export type InsertAlbum = z.infer<typeof insertAlbumSchema>;
export type Album = typeof albumsTable.$inferSelect;
