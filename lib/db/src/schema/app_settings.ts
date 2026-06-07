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
  footerText: text("footer_text").default("© Cotopia. All rights reserved."),
  songSubmissionFee: text("song_submission_fee").notNull().default("9.99"),
  videoSubmissionFee: text("video_submission_fee").notNull().default("19.99"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable).omit({ id: true, updatedAt: true });
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettingsTable.$inferSelect;
