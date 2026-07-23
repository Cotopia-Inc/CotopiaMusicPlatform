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

      -- Payment mode configuration (added Jul 2026)
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'demo';

      -- Payments table — enriched payment audit fields (added Jul 2026)
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'demo';
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'demo';
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS external_transaction_id TEXT;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS demo_confirmation_number TEXT;

      -- Normalize existing "pending/completed" statuses to new vocabulary
      UPDATE payments SET status = 'initiated' WHERE status = 'pending';
      UPDATE payments SET status = 'completed' WHERE status = 'completed';

      -- AI / human-origin tagging columns on songs (added Jul 2026)
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS creation_method TEXT NOT NULL DEFAULT 'unclassified';
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS creator_selected_tag TEXT;
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS platform_assigned_tag TEXT;
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS effective_display_tag TEXT NOT NULL DEFAULT 'unclassified';
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS tag_source TEXT;
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS tag_locked BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS ai_estimate_percent REAL;
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS ai_confidence_level TEXT;
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS ai_risk_level TEXT;
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS ai_detection_reasons JSONB;
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS ai_review_status TEXT NOT NULL DEFAULT 'not_scanned';
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS ai_reviewed_by INTEGER;
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS ai_override_reason TEXT;
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS appeal_status TEXT;

      -- AI / human-origin tagging columns on videos (added Jul 2026)
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS creation_method TEXT NOT NULL DEFAULT 'unclassified';
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS creator_selected_tag TEXT;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS platform_assigned_tag TEXT;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS effective_display_tag TEXT NOT NULL DEFAULT 'unclassified';
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS tag_source TEXT;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS tag_locked BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS ai_estimate_percent REAL;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS ai_confidence_level TEXT;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS ai_risk_level TEXT;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS ai_detection_reasons JSONB;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS ai_review_status TEXT NOT NULL DEFAULT 'not_scanned';
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS ai_reviewed_by INTEGER;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS ai_override_reason TEXT;
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS appeal_status TEXT;

      -- AI columns on submissions (added Jul 2026)
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS creation_method TEXT NOT NULL DEFAULT 'unclassified';
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_review_status TEXT NOT NULL DEFAULT 'not_scanned';
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_override_reason TEXT;

      -- AI badge visibility & review settings on app_settings (added Jul 2026)
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS show_human_badge BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS show_ai_badge BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS show_hybrid_badge BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS show_fully_ai_badge BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS show_title_icons BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS show_cover_overlays BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS allow_creator_self_tagging BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS enable_ai_review BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS auto_reject_fully_ai BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS auto_reject_detection_threshold INTEGER NOT NULL DEFAULT 95;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ai_low_threshold INTEGER NOT NULL DEFAULT 25;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ai_high_threshold INTEGER NOT NULL DEFAULT 60;
      ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ai_critical_threshold INTEGER NOT NULL DEFAULT 90;

      -- AI detection scans table (added Jul 2026)
      CREATE TABLE IF NOT EXISTS ai_detection_scans (
        id SERIAL PRIMARY KEY,
        content_type TEXT NOT NULL,
        content_id INTEGER NOT NULL,
        provider TEXT NOT NULL DEFAULT 'hive',
        model_version TEXT,
        file_hash TEXT,
        scan_status TEXT NOT NULL DEFAULT 'pending',
        raw_result JSONB,
        ai_likelihood_percent REAL,
        confidence_level TEXT,
        risk_level TEXT,
        detection_indicators JSONB,
        error_message TEXT,
        requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        scanned_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      -- Web Push subscriptions table (added Jul 2026; NOT covered by Drizzle push — must live here)
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      -- Creator Support: per-creator payment config (added Jul 2026)
      CREATE TABLE IF NOT EXISTS creator_payment_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        support_enabled BOOLEAN NOT NULL DEFAULT false,
        provider TEXT NOT NULL DEFAULT 'paypal',
        paypal_email TEXT,
        paypal_me_link TEXT,
        thank_you_message TEXT,
        support_wall_enabled BOOLEAN NOT NULL DEFAULT true,
        support_wall_requires_approval BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT creator_payment_settings_user_unique UNIQUE (user_id)
      );

      -- Creator Support: demo tip / activity ledger (added Jul 2026)
      CREATE TABLE IF NOT EXISTS support_transactions (
        id SERIAL PRIMARY KEY,
        supporter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content_type TEXT NOT NULL,
        content_id INTEGER,
        amount TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        message TEXT,
        message_visibility TEXT NOT NULL DEFAULT 'private',
        moderation_status TEXT NOT NULL DEFAULT 'approved',
        transaction_ref TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'paypal',
        mode TEXT NOT NULL DEFAULT 'demo',
        status TEXT NOT NULL DEFAULT 'completed',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT support_transactions_ref_unique UNIQUE (transaction_ref)
      );
    `);

    // ── Individual column migrations ────────────────────────────────────────
    // Each ALTER TABLE runs as its own query so one failure never blocks the
    // others. Order matters only when a later migration depends on an earlier
    // one — otherwise they are fully independent.
    const columnMigrations: Array<[string, string]> = [
      // trust_appeals columns (Jul 2026)
      ["trust_appeals content_type", "ALTER TABLE trust_appeals ADD COLUMN IF NOT EXISTS content_type TEXT"],
      ["trust_appeals content_id",   "ALTER TABLE trust_appeals ADD COLUMN IF NOT EXISTS content_id INTEGER"],
      // cover art admin review (Jul 2026)
      ["songs cover_art_review_decision",  "ALTER TABLE songs  ADD COLUMN IF NOT EXISTS cover_art_review_decision TEXT"],
      ["songs cover_art_review_note",      "ALTER TABLE songs  ADD COLUMN IF NOT EXISTS cover_art_review_note TEXT"],
      ["videos cover_art_review_decision", "ALTER TABLE videos ADD COLUMN IF NOT EXISTS cover_art_review_decision TEXT"],
      ["videos cover_art_review_note",     "ALTER TABLE videos ADD COLUMN IF NOT EXISTS cover_art_review_note TEXT"],
    ];

    for (const [label, sql] of columnMigrations) {
      try {
        await client.query(sql);
      } catch (colErr) {
        logger.error({ err: colErr, label }, "ensureTables: column migration failed");
      }
    }

    // Idempotent data fixes (safe to re-run; skip silently if trust_appeals
    // column didn't exist yet — that case is caught above).
    const dataMigrations: Array<[string, string]> = [
      ["trust_appeals status submitted",          "UPDATE trust_appeals SET status = 'submitted' WHERE status = 'received'"],
      ["trust_appeals status evidence_requested", "UPDATE trust_appeals SET status = 'evidence_requested' WHERE status = 'more_info_needed'"],
    ];

    for (const [label, sql] of dataMigrations) {
      try {
        await client.query(sql);
      } catch (dataErr) {
        logger.error({ err: dataErr, label }, "ensureTables: data migration failed");
      }
    }

    logger.info("ensureTables: schema up to date");
  } catch (err) {
    logger.error({ err }, "ensureTables: failed to sync schema");
  } finally {
    client.release();
  }
}
