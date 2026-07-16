import path from "path";
import fs from "fs";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, appSettingsTable } from "@workspace/db";
import { verifyToken } from "./lib/auth";
import { getMaintenanceCached, setMaintenanceCache } from "./lib/maintenance-cache";

const app: Express = express();

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
// Exempted paths: auth endpoints (so admins can log in), admin/settings (so
// admins can turn maintenance off), platform-config, and storage.
app.use("/api", async (req, res, next) => {
  const p = req.path;
  if (
    p.startsWith("/auth/") ||
    p === "/platform-config" ||
    p.startsWith("/admin/settings") ||
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
