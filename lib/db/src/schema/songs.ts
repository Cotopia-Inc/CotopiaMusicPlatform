import { pgTable, text, serial, timestamp, integer, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { artistsTable } from "./artists";
import { albumsTable } from "./albums";

export const songsTable = pgTable("songs", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull().references(() => artistsTable.id, { onDelete: "cascade" }),
  albumId: integer("album_id").references(() => albumsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  genre: text("genre"),
  duration: integer("duration").notNull().default(0), // seconds
  coverUrl: text("cover_url"),
  streamUrl: text("stream_url"),
  lyrics: text("lyrics"),
  credits: text("credits"),
  playCount: integer("play_count").notNull().default(0),
  releaseType: text("release_type").notNull().default("single"), // single | ep | album
  status: text("status").notNull().default("draft"), // draft | pending_review | approved | rejected | published
  isFeatured: boolean("is_featured").notNull().default(false),
  releaseDate: date("release_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSongSchema = createInsertSchema(songsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSong = z.infer<typeof insertSongSchema>;
export type Song = typeof songsTable.$inferSelect;
