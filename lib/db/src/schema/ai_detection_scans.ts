import { pgTable, text, serial, timestamp, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Stores each AI-detection scan result from a provider (e.g. Hive Moderation).
 * Linked to songs or videos by contentType + contentId.
 * Multiple scans may exist for the same content (rescans, provider changes).
 */
export const aiDetectionScansTable = pgTable("ai_detection_scans", {
  id: serial("id").primaryKey(),
  contentType: text("content_type").notNull(),       // song | video
  contentId: integer("content_id").notNull(),
  provider: text("provider").notNull().default("hive"), // detection provider name
  modelVersion: text("model_version"),               // provider model/version string
  fileHash: text("file_hash"),                        // SHA-256 of scanned file
  // pending | complete | failed | unavailable
  scanStatus: text("scan_status").notNull().default("pending"),
  rawResult: jsonb("raw_result"),                     // full provider response (advisory only)
  // 0–100 estimated AI likelihood — NEVER treat as conclusive proof
  aiLikelihoodPercent: real("ai_likelihood_percent"),
  // unavailable | low | medium | high
  confidenceLevel: text("confidence_level"),
  // low | moderate | high | critical
  riskLevel: text("risk_level"),
  detectionIndicators: jsonb("detection_indicators"), // array of indicator strings
  errorMessage: text("error_message"),
  requestedBy: integer("requested_by").references(() => usersTable.id, { onDelete: "set null" }),
  scannedAt: timestamp("scanned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiDetectionScanSchema = createInsertSchema(aiDetectionScansTable).omit({ id: true, createdAt: true });
export type InsertAiDetectionScan = z.infer<typeof insertAiDetectionScanSchema>;
export type AiDetectionScan = typeof aiDetectionScansTable.$inferSelect;
