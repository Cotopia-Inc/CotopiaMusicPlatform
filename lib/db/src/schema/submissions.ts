import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const submissionsTable = pgTable("submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // song | video
  contentId: integer("content_id"),
  // draft | pending_payment | paid | pending_moderator_review | moderator_approved
  // | moderator_rejected | escalated_to_admin | pending_admin_final_review
  // | admin_approved | rejected | published
  status: text("status").notNull().default("pending_moderator_review"),
  paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid | paid | refunded
  submitterNotes: text("submitter_notes"),
  moderatorNotes: text("moderator_notes"),
  adminNotes: text("admin_notes"),
  plan: text("plan").notNull().default("basic"),
  // ── AI / Human origin (declared at submission time) ───────────────────────
  // unclassified | human_created | ai_assisted | hybrid_human_ai | fully_ai_generated
  creationMethod: text("creation_method").notNull().default("unclassified"),
  // not_scanned | scan_pending | scan_complete | moderator_review | escalated_to_admin
  // | evidence_requested | admin_approved | admin_rejected | auto_rejected | appealed | appeal_resolved
  aiReviewStatus: text("ai_review_status").notNull().default("not_scanned"),
  aiOverrideReason: text("ai_override_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSubmissionSchema = createInsertSchema(submissionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissionsTable.$inferSelect;
