import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function ensureTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS badges (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'achievement',
        icon TEXT NOT NULL DEFAULT '🏆',
        color TEXT,
        is_visible BOOLEAN NOT NULL DEFAULT true,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT badges_name_unique UNIQUE (name)
      );

      CREATE TABLE IF NOT EXISTS user_badges (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
        awarded_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_featured BOOLEAN NOT NULL DEFAULT false,
        feature_order SMALLINT,
        reason TEXT,
        awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT user_badges_user_badge_unique UNIQUE (user_id, badge_id)
      );

      CREATE TABLE IF NOT EXISTS bug_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_email TEXT,
        what_happened TEXT NOT NULL,
        page_url TEXT,
        what_trying TEXT,
        device_browser TEXT,
        severity TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'new',
        admin_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS experience_feedback (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        rating INTEGER NOT NULL,
        what_worked_well TEXT,
        what_was_confusing TEXT,
        did_anything_break TEXT,
        would_recommend BOOLEAN,
        trigger TEXT NOT NULL DEFAULT 'general',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS feature_suggestions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_email TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        why TEXT,
        category TEXT NOT NULL DEFAULT 'other',
        priority TEXT NOT NULL DEFAULT 'nice_to_have',
        status TEXT NOT NULL DEFAULT 'new',
        admin_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS x_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS pinterest_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS website_url_1 TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS website_url_2 TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS website_url_3 TEXT;

      -- app_settings columns added after initial schema (safe to run every startup)
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS single_song_fee TEXT NOT NULL DEFAULT '9.99';
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS batch_song_fee TEXT NOT NULL DEFAULT '19.99';
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS premium_song_fee TEXT NOT NULL DEFAULT '49.99';
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS single_video_fee TEXT NOT NULL DEFAULT '14.99';
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS batch_video_fee TEXT NOT NULL DEFAULT '29.99';
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS premium_video_fee TEXT NOT NULL DEFAULT '79.99';
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS show_top_rated BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS top_rated_min_ratings INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS refund_policy_text TEXT;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ai_policy_text TEXT;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS community_rules_text TEXT;
    `);
    logger.info("ensureTables: schema up to date");
  } catch (err) {
    logger.error({ err }, "ensureTables: failed to sync schema");
  } finally {
    client.release();
  }
}
