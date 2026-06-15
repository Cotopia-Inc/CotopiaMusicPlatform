import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
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
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  requireEmailVerification: boolean("require_email_verification").notNull().default(true),
  featureRotation: boolean("feature_rotation").notNull().default(true),
  termsVersion: text("terms_version").default("1.0"),
  privacyVersion: text("privacy_version").default("1.0"),
  submissionAgreementVersion: text("submission_agreement_version").default("1.0"),
  dmcaContactEmail: text("dmca_contact_email").default("legal@cotopia.org"),
  copyrightAgentInfo: text("copyright_agent_info").default("Cotopia Legal Team, legal@cotopia.org"),
  refundPolicyText: text("refund_policy_text"),
  aiPolicyText: text("ai_policy_text"),
  communityRulesText: text("community_rules_text"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable).omit({ id: true, updatedAt: true });
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettingsTable.$inferSelect;
