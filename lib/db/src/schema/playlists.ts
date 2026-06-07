import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { songsTable } from "./songs";

export const playlistsTable = pgTable("playlists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const playlistItemsTable = pgTable("playlist_items", {
  id: serial("id").primaryKey(),
  playlistId: integer("playlist_id").notNull().references(() => playlistsTable.id, { onDelete: "cascade" }),
  songId: integer("song_id").notNull().references(() => songsTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlaylistSchema = createInsertSchema(playlistsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlaylistItemSchema = createInsertSchema(playlistItemsTable).omit({ id: true, addedAt: true });
export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;
export type InsertPlaylistItem = z.infer<typeof insertPlaylistItemSchema>;
export type Playlist = typeof playlistsTable.$inferSelect;
export type PlaylistItem = typeof playlistItemsTable.$inferSelect;
