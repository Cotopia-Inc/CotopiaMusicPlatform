import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/version", (_req, res) => {
  res.json({
    commit: process.env.RENDER_GIT_COMMIT ?? "dev",
    node: process.version,
    env: process.env.NODE_ENV ?? "unknown",
  });
});

export default router;
