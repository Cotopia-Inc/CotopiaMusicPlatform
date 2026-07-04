import path from "path";
import fs from "fs";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

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
        error: "File is too large. Maximum upload size is 500MB.",
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
  app.use(express.static(staticDir));
  app.use((_req, res) => {
    // Never let the browser (or its back/forward cache) serve a stale copy of
    // the SPA shell — otherwise a logged-out user could hit "back" and see a
    // cached snapshot of a page rendered while they were signed in.
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private",
    );
    res.setHeader("Pragma", "no-cache");
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
