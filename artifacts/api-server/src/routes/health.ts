import { Router } from "express";
import { db, appSettingsTable, pool } from "@workspace/db";

const router = Router();

// ── GET /healthz ────────────────────────────────────────────────────────────
// Legacy lightweight health check (kept for backwards compatibility).
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// ── GET /version ─────────────────────────────────────────────────────────────
router.get("/version", (_req, res) => {
  res.json({
    commit: process.env.RENDER_GIT_COMMIT ?? "dev",
    node: process.version,
    env: process.env.NODE_ENV ?? "unknown",
  });
});

// ── GET /health ─────────────────────────────────────────────────────────────
// Full health check with real sub-system probes.
// Returns 200 if all critical checks pass, 503 otherwise.
// Safe to expose publicly (no sensitive data returned).
router.get("/health", async (_req, res): Promise<void> => {
  const startTime = Date.now();

  // 1. Database probe
  let dbOk = false;
  let dbError: string | null = null;
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  // 2. Storage probe (credential presence — no actual object fetch)
  const hasGcs = Boolean(process.env.GCS_BUCKET);
  const hasR2  = Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_API_TOKEN   &&
    process.env.R2_BUCKET_NAME
  );
  const storageConfigured = hasGcs || hasR2;
  const storageProvider   = hasR2 ? "cloudflare-r2" : hasGcs ? "google-cloud-storage" : "local-disk";

  // 3. Email probe (credential presence)
  const emailOk = Boolean(process.env.RESEND_API_KEY);

  // 4. Payment mode
  let paymentMode = "demo";
  try {
    const [settings] = await db
      .select({ paymentMode: appSettingsTable.paymentMode })
      .from(appSettingsTable)
      .limit(1);
    paymentMode = settings?.paymentMode ?? "demo";
  } catch {
    // Non-critical — don't let a settings query failure mark the whole app unhealthy
  }

  const critical = dbOk;
  const status   = critical ? "healthy" : "degraded";

  res.status(critical ? 200 : 503).json({
    status,
    version: process.env.npm_package_version ?? "unknown",
    uptime_seconds: Math.floor(process.uptime()),
    latency_ms: Date.now() - startTime,
    checks: {
      database: {
        ok: dbOk,
        error: dbError,
      },
      storage: {
        ok: storageConfigured,
        provider: storageProvider,
        note: storageConfigured ? null : "No cloud storage credentials configured — using local disk (dev only)",
      },
      email: {
        ok: emailOk,
        provider: emailOk ? "resend" : null,
        note: emailOk ? null : "RESEND_API_KEY not set — email sending disabled",
      },
      payment: {
        ok: true,
        mode: paymentMode,
        is_demo: paymentMode === "demo",
        note: paymentMode === "demo" ? "Demo mode — no real payments processed" : null,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// ── GET /ready ──────────────────────────────────────────────────────────────
// Minimal readiness probe — only checks DB connectivity.
// Used by load balancers / container orchestrators.
router.get("/ready", async (_req, res): Promise<void> => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    res.status(200).json({ ready: true, timestamp: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(503).json({ ready: false, error: message, timestamp: new Date().toISOString() });
  }
});

export default router;
