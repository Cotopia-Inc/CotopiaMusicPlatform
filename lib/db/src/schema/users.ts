import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  profileVideoUrl: text("profile_video_url"),
  bio: text("bio"),
  role: text("role").notNull().default("listener"), // listener | artist | label | business | admin | moderator | editor | master_admin
  isVerified: boolean("is_verified").notNull().default(false),
  verificationType: text("verification_type"), // null | artist | label (set when admin grants verified status)
  isSuspended: boolean("is_suspended").notNull().default(false),
  suspendedUntil: timestamp("suspended_until", { withTimezone: true }), // temporary suspension expiry; null = indefinite/none
  isBanned: boolean("is_banned").notNull().default(false), // permanent ban
  messagePolicy: text("message_policy").notNull().default("everyone"), // everyone | followers_only | verified_only | nobody
  isActive: boolean("is_active").notNull().default(true),
  emailVerified: boolean("email_verified").notNull().default(false),
  // Demographics (collected after signup)
  realName: text("real_name"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  postalCode: text("postal_code"),
  sex: text("sex"),
  race: text("race"),
  dateOfBirth: text("date_of_birth"),
  phone: text("phone"),
  demographicsCompleted: boolean("demographics_completed").notNull().default(false),
  instagramUrl: text("instagram_url"),
  xUrl: text("x_url"),
  tiktokUrl: text("tiktok_url"),
  linkedinUrl: text("linkedin_url"),
  pinterestUrl: text("pinterest_url"),
  websiteUrl1: text("website_url_1"),
  websiteUrl2: text("website_url_2"),
  websiteUrl3: text("website_url_3"),
  deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
