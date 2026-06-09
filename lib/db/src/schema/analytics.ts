import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analyticsEventsTable = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(), // user | content | engagement | admin
  eventName: text("event_name").notNull().default("unknown"), // registration | login | song_play | song_complete | video_play | favorite_added | follow | comment_added | playlist_add | role_changed | ...
  userId: integer("user_id"),
  contentType: text("content_type"), // song | video | playlist | user
  contentId: integer("content_id"),
  metadata: text("metadata"), // JSON string for extra data
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEventsTable).omit({ id: true, createdAt: true });
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEventsTable.$inferSelect;
