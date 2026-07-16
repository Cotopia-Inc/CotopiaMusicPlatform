import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  appName: text("app_name").notNull().default("Cotopia"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#6366f1"),
  secondaryColor: text("secondary_color").default("#8b5cf6"),
  accentColor: text("accent_color").default("#ec4899"),
  footerText: text("footer_text").default("Everyday Radio by Cotopia is an independent platform for music, video, discovery, promotion, and community. Users retain ownership of their content and grant Cotopia limited rights to host, stream, display, and promote submitted content. Powered by Cotopia."),
  songSubmissionFee: text("song_submission_fee").notNull().default("9.99"),
  videoSubmissionFee: text("video_submission_fee").notNull().default("19.99"),
  singleSongFee: text("single_song_fee").notNull().default("9.99"),
  batchSongFee: text("batch_song_fee").notNull().default("19.99"),
  premiumSongFee: text("premium_song_fee").notNull().default("49.99"),
  singleVideoFee: text("single_video_fee").notNull().default("14.99"),
  batchVideoFee: text("batch_video_fee").notNull().default("29.99"),
  premiumVideoFee: text("premium_video_fee").notNull().default("79.99"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  requireEmailVerification: boolean("require_email_verification").notNull().default(true),
  featureRotation: boolean("feature_rotation").notNull().default(true),
  autoEscalationEnabled: boolean("auto_escalation_enabled").notNull().default(true),
  strikesUntilSuspension: integer("strikes_until_suspension").notNull().default(3),
  autoSuspensionDays: integer("auto_suspension_days").notNull().default(7),
  suspensionsUntilBanReview: integer("suspensions_until_ban_review").notNull().default(3),
  termsVersion: text("terms_version").default("1.0"),
  privacyVersion: text("privacy_version").default("1.0"),
  submissionAgreementVersion: text("submission_agreement_version").default("1.0"),
  contentLicenseVersion: text("content_license_version").default("1.0"),
  aiPolicyVersion: text("ai_policy_version").default("1.0"),
  communityGuidelinesVersion: text("community_guidelines_version").default("1.0"),
  refundPolicyVersion: text("refund_policy_version").default("1.0"),
  dmcaContactEmail: text("dmca_contact_email").default("legal@cotopia.org"),
  copyrightAgentInfo: text("copyright_agent_info").default("Cotopia Legal Team, legal@cotopia.org"),
  refundPolicyText: text("refund_policy_text"),
  aiPolicyText: text("ai_policy_text"),
  communityRulesText: text("community_rules_text"),
  showTopRated: boolean("show_top_rated").notNull().default(true),
  topRatedMinRatings: integer("top_rated_min_ratings").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable).omit({ id: true, updatedAt: true });
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettingsTable.$inferSelect;
