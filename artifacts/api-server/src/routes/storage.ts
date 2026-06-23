import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { saveFile, readFile, FileNotFoundError } from "../lib/localFileStorage";

const router: IRouter = Router();

/**
 * POST /storage/uploads/upload
 *
 * Server-side upload: browser POSTs the raw file bytes here; the server writes
 * them to local disk (STORAGE_DIR env var, falls back to os.tmpdir() in dev).
 * Returns { objectPath, metadata } — same shape as before.
 *
 * Headers:
 *   Content-Type   — file MIME type
 *   X-File-Name    — URL-encoded original filename
 */
router.post(
  "/storage/uploads/upload",
  express.raw({ type: "*/*", limit: "200mb" }),
  async (req: Request, res: Response) => {
    const rawName = req.headers["x-file-name"];
    const name = rawName
      ? decodeURIComponent(Array.isArray(rawName) ? rawName[0] : rawName)
      : "upload";
    const contentType =
      (Array.isArray(req.headers["content-type"])
        ? req.headers["content-type"][0]
        : req.headers["content-type"]) ?? "application/octet-stream";
    const body = req.body as Buffer;

    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "No file data provided" });
      return;
    }

    try {
      const { objectPath, size } = await saveFile(body, name, contentType);
      res.json({
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      req.log.error({ err: error }, "Error saving uploaded file");
      res.status(500).json({ error: "Failed to upload file" });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve a stored file by its objectPath (/objects/uploads/<id>).
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    const { buffer, meta } = await readFile(objectPath);

    res.setHeader("Content-Type", meta.contentType);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  } catch (error) {
    if (error instanceof FileNotFoundError) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving stored file");
    res.status(500).json({ error: "Failed to serve file" });
  }
});

export default router;
