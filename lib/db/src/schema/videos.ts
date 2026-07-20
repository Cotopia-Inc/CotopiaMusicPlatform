import { pgTable, text, serial, timestamp, integer, boolean, date, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { artistsTable } from "./artists";

export const videosTable = pgTable("videos", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull().references(() => artistsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  credits: text("credits"),
  genre: text("genre"),
  mood: text("mood"),
  isExplicit: boolean("is_explicit").notNull().default(false),
  duration: integer("duration").notNull().default(0),
  thumbnailUrl: text("thumbnail_url"),
  videoUrl: text("video_url"),
  viewCount: integer("view_count").notNull().default(0),
  status: text("status").notNull().default("draft"),
  isFeatured: boolean("is_featured").notNull().default(false),
  releaseDate: date("release_date"),
  // ── AI / Human origin classification ─────────────────────────────────────
  creationMethod: text("creation_method").notNull().default("unclassified"),
  creatorSelectedTag: text("creator_selected_tag"),
  platformAssignedTag: text("platform_assigned_tag"),
  effectiveDisplayTag: text("effective_display_tag").notNull().default("unclassified"),
  tagSource: text("tag_source"),
  tagLocked: boolean("tag_locked").notNull().default(false),
  aiEstimatePercent: real("ai_estimate_percent"),
  aiConfidenceLevel: text("ai_confidence_level"),
  aiRiskLevel: text("ai_risk_level"),
  aiDetectionReasons: jsonb("ai_detection_reasons"),
  aiReviewStatus: text("ai_review_status").notNull().default("not_scanned"),
  aiReviewedBy: integer("ai_reviewed_by"),
  aiReviewedAt: timestamp("ai_reviewed_at", { withTimezone: true }),
  aiOverrideReason: text("ai_override_reason"),
  appealStatus: text("appeal_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVideoSchema = createInsertSchema(videosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videosTable.$inferSelect;
