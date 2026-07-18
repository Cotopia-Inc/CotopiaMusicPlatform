import app from "./app";
import { logger } from "./lib/logger";
import { startReleaseScheduler } from "./lib/publisher";
import { ensureTables } from "./lib/ensure-tables";

// ── Startup environment validation ────────────────────────────────────────
// Log the status of every required / optional env var at startup so operators
// can diagnose misconfigured deployments quickly without exposing values.
const isProduction = process.env.NODE_ENV === "production";

const DEV_FALLBACK_SECRET = "cotopia-dev-secret-change-in-production";

const envChecks: Array<{ key: string; required: boolean; note?: string }> = [
  { key: "PORT", required: true },
  { key: "DATABASE_URL", required: true },
  {
    key: "SESSION_SECRET",
    required: false,
    note: "strongly recommended in production — insecure fallback used when absent",
  },
  { key: "RESEND_API_KEY", required: false, note: "email sending disabled without this" },
  { key: "ALLOWED_ORIGINS", required: false, note: "CORS allows all origins when missing (dev only)" },
  { key: "PAYPAL_CLIENT_ID", required: false, note: "needed only for paypal_sandbox / paypal_live modes" },
  { key: "PAYPAL_CLIENT_SECRET", required: false, note: "needed only for paypal_sandbox / paypal_live modes" },
  { key: "GCS_BUCKET", required: false, note: "Google Cloud Storage (Replit dev file storage)" },
  { key: "R2_ACCOUNT_ID", required: false, note: "Cloudflare R2 storage (Render prod)" },
  { key: "R2_API_TOKEN", required: false, note: "Cloudflare R2 storage (Render prod)" },
  { key: "R2_BUCKET_NAME", required: false, note: "Cloudflare R2 storage (Render prod)" },
  { key: "R2_PUBLIC_URL", required: false, note: "Cloudflare R2 public base URL" },
];

const missing: string[] = [];
for (const check of envChecks) {
  const value = process.env[check.key];
  const present = Boolean(value);
  if (!present && check.required) {
    missing.push(check.key);
    logger.error({ key: check.key, note: check.note }, `STARTUP: required env var missing — ${check.key}`);
  } else if (!present) {
    logger.warn({ key: check.key, note: check.note }, `STARTUP: optional env var not set — ${check.key}`);
  } else {
    logger.info({ key: check.key }, `STARTUP: env var present — ${check.key}`);
  }
}

// In production, warn loudly if the JWT secret is the insecure dev fallback.
// We do NOT exit — the app was previously using this fallback on Render and
// must continue to work until the operator sets a proper secret.
if (isProduction) {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    logger.error(
      "STARTUP: SESSION_SECRET is not set. The insecure development fallback " +
      "is being used. Set SESSION_SECRET in your production environment immediately.",
    );
  } else if (secret === DEV_FALLBACK_SECRET) {
    logger.warn(
      "STARTUP: SESSION_SECRET is set to the development default value. " +
      "This is insecure. Set a strong random secret in your production environment.",
    );
  }
}

if (missing.length > 0) {
  logger.error({ missing }, "STARTUP: required environment variables missing — refusing to start");
  process.exit(1);
}

// ── Port validation ───────────────────────────────────────────────────────
const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

void ensureTables().then(() => {
  const server = app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startReleaseScheduler();
  });

  // Large file uploads (e.g. 200MB videos) can take several minutes on slow
  // connections. Node's default requestTimeout (5 min) and headersTimeout
  // (1 min) are too tight for that and silently kill the connection mid-upload
  // (surfacing to the client as a generic "Network error"). keepAliveTimeout
  // must exceed the reverse proxy's idle timeout (Replit/Render both use ~60s)
  // so the proxy doesn't reuse a connection the server has already closed.
  server.requestTimeout = 15 * 60 * 1000;
  server.headersTimeout = 70 * 1000;
  server.keepAliveTimeout = 65 * 1000;
});
