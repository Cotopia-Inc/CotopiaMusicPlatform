import { pgTable, text, serial, timestamp, integer, boolean, date, jsonb, real } from "drizzle-orm/pg-core";
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
  mood: text("mood"),
  isExplicit: boolean("is_explicit").notNull().default(false),
  lyrics: text("lyrics"),
  credits: text("credits"),
  playCount: integer("play_count").notNull().default(0),
  releaseType: text("release_type").notNull().default("single"), // single | ep | album
  status: text("status").notNull().default("draft"), // draft | pending_review | approved | rejected | published
  isFeatured: boolean("is_featured").notNull().default(false),
  releaseDate: date("release_date"),
  // ── AI / Human origin classification ─────────────────────────────────────
  // unclassified | human_created | ai_assisted | hybrid_human_ai | fully_ai_generated | disputed | under_review
  creationMethod: text("creation_method").notNull().default("unclassified"),
  creatorSelectedTag: text("creator_selected_tag"),           // what the creator declared
  platformAssignedTag: text("platform_assigned_tag"),         // what admin/mod assigned
  effectiveDisplayTag: text("effective_display_tag").notNull().default("unclassified"), // resolved tag shown publicly
  tagSource: text("tag_source"),                              // creator | moderator_flag | admin | detection_system | appeal_decision
  tagLocked: boolean("tag_locked").notNull().default(false),  // true = creator cannot change
  aiEstimatePercent: real("ai_estimate_percent"),             // 0–100, from detection provider
  aiConfidenceLevel: text("ai_confidence_level"),             // unavailable | low | medium | high
  aiRiskLevel: text("ai_risk_level"),                         // low | moderate | high | critical
  aiDetectionReasons: jsonb("ai_detection_reasons"),          // array of reason strings from provider
  // not_scanned | scan_pending | scan_complete | moderator_review | escalated_to_admin
  // | evidence_requested | admin_approved | admin_rejected | auto_rejected | appealed | appeal_resolved
  aiReviewStatus: text("ai_review_status").notNull().default("not_scanned"),
  aiReviewedBy: integer("ai_reviewed_by"),                    // user id of last reviewer
  aiReviewedAt: timestamp("ai_reviewed_at", { withTimezone: true }),
  aiOverrideReason: text("ai_override_reason"),               // written reason when admin overrides
  appealStatus: text("appeal_status"),                        // submitted | under_review | evidence_requested | upheld | reversed | modified | closed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSongSchema = createInsertSchema(songsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSong = z.infer<typeof insertSongSchema>;
export type Song = typeof songsTable.$inferSelect;
