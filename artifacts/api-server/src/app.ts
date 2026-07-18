import path from "path";
import fs from "fs";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, appSettingsTable } from "@workspace/db";
import { verifyToken } from "./lib/auth";
import { getMaintenanceCached, setMaintenanceCache } from "./lib/maintenance-cache";
import { botDetection } from "./lib/bot-detection";
import { apiRateLimit, authRateLimit } from "./lib/rate-limit";

const app: Express = express();

// Trust the first proxy hop (Render's edge / Replit's reverse proxy).
// This makes req.ip resolve to the real client IP from X-Forwarded-For,
// which express-rate-limit uses to key rate-limit buckets per client.
app.set("trust proxy", 1);

// ── Security headers ──────────────────────────────────────────────────────
// helmet sets a safe baseline of HTTP security headers.
// contentSecurityPolicy is disabled here because the SPA's Vite build
// already inlines styles and uses hashed chunk filenames — a CSP would need
// to enumerate every chunk hash and would break on every build. This can be
// re-enabled with a nonce-based policy in a future pass.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────
// In production, restrict to known origins from the ALLOWED_ORIGINS env var
// (comma-separated list). In development, allow all origins for convenience.
const isProduction = process.env.NODE_ENV === "production";
const allowedOriginsList = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: isProduction && allowedOriginsList.length > 0
      ? (origin, callback) => {
          // Allow requests with no origin (e.g. server-to-server, mobile apps)
          if (!origin) { callback(null, true); return; }
          if (allowedOriginsList.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`CORS: origin ${origin} not allowed`));
          }
        }
      : true,
    credentials: true,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Anti-scraping defenses ────────────────────────────────────────────────
// Applied before every /api route — bot detection first (cheapest), then
// rate limiting. Ordering matters: blocked bots never consume a rate-limit
// slot, and the general limit fires before any route handler touches the DB.

// 1. Block known automated User-Agents (scrapers, crawlers, headless clients)
app.use("/api", botDetection);

// 2. General API rate limit: 300 req / 15 min per IP — plenty for real users
app.use("/api", apiRateLimit);

// 3. Stricter auth-endpoint limit: 10 req / 15 min per IP — blocks brute-force
//    on login, register, and password-reset mutations.
app.use("/api/auth", authRateLimit);

// ── Maintenance mode gate ─────────────────────────────────────────────────
// 30-second in-memory cache so we don't hit the DB on every request.
async function getMaintenanceMode(): Promise<boolean> {
  const cached = getMaintenanceCached();
  if (cached !== null) return cached;
  try {
    const [s] = await db
      .select({ maintenanceMode: appSettingsTable.maintenanceMode })
      .from(appSettingsTable)
      .limit(1);
    const v = s?.maintenanceMode ?? false;
    setMaintenanceCache(v);
    return v;
  } catch {
    setMaintenanceCache(false);
    return false;
  }
}

// Block non-admin API traffic when maintenance mode is on.
// Exempted paths: auth endpoints (login), all /admin/* routes (they carry their
// own requireAuth/requireRole guards), platform-config, and storage.
app.use("/api", async (req, res, next) => {
  const p = req.path;
  if (
    p.startsWith("/auth/") ||
    p === "/platform-config" ||
    p.startsWith("/admin/") ||
    p.startsWith("/storage/")
  ) {
    next(); return;
  }

  const inMaintenance = await getMaintenanceMode();
  if (!inMaintenance) { next(); return; }

  // Allow admins through even during maintenance
  const authHeader = req.headers.authorization as string | undefined;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    const decoded = verifyToken(token);
    if (decoded && (decoded.role === "admin" || decoded.role === "master_admin")) {
      next(); return;
    }
  }

  res.status(503).json({ error: "Platform is currently in maintenance mode. Please check back soon." });
});

app.use("/api", router);

// Body-parser (express.json/urlencoded/raw) errors — e.g. oversized upload
// bodies — land here instead of the route handler. Return JSON so API
// clients get a parseable error instead of Express's default HTML page.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (
      err &&
      typeof err === "object" &&
      "type" in err &&
      (err as { type?: string }).type === "entity.too.large"
    ) {
      res.status(413).json({
        error: "File is too large. Maximum upload size is 10GB.",
      });
      return;
    }
    next(err);
  },
);

// Catch-all JSON error handler — prevents Express from returning HTML 500 pages
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const e = err as { status?: number; statusCode?: number; message?: string };
    const status = e?.status ?? e?.statusCode ?? 500;
    const message =
      (err instanceof Error ? err.message : undefined) ?? "Internal server error";
    res.status(status).json({ error: message });
  },
);

// Serve the built Vite frontend if the static dir exists (production / Render)
const staticDir = path.resolve(
  process.cwd(),
  process.env.STATIC_DIR ?? "artifacts/cotopia/dist/public",
);
if (fs.existsSync(staticDir)) {
  // Serve hashed JS/CSS assets with long-lived caching, but force index.html
  // to never be cached. This prevents a "blank screen on refresh" bug: when a
  // new deploy changes chunk filenames, a browser holding a stale cached
  // index.html would request old chunk URLs that no longer exist, causing React
  // to fail silently and show nothing.
  app.use(
    express.static(staticDir, {
      setHeaders(res, filePath) {
        if (path.basename(filePath) === "index.html") {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
          res.setHeader("Pragma", "no-cache");
        }
      },
    }),
  );
  app.use((_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
