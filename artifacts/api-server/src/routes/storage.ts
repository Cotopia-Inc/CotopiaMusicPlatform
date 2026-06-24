import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { randomUUID } from "crypto";
import { objectStorageClient, ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { saveFile, readFile, FileNotFoundError } from "../lib/localFileStorage";

const router: IRouter = Router();
const storageService = new ObjectStorageService();

/**
 * Returns true when running inside Replit with GCS object storage configured.
 * Falls back to local disk on other platforms (e.g. Render).
 */
function gcsAvailable(): boolean {
  return Boolean(process.env.PRIVATE_OBJECT_DIR && process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID);
}

function parseBucketPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

/**
 * POST /storage/uploads/upload
 *
 * Server-mediated upload: browser POSTs the raw file bytes; the server
 * writes them to GCS (Replit Object Storage, persistent) when running on
 * Replit, or to local disk as a fallback on other platforms.
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
      if (gcsAvailable()) {
        // Replit: write to GCS — files persist across restarts
        const id = randomUUID();
        const privateDir = storageService.getPrivateObjectDir();
        const fullPath = `${privateDir}/uploads/${id}`;
        const { bucketName, objectName } = parseBucketPath(fullPath);
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(objectName);

        await file.save(body, { contentType, metadata: { originalName: name } });
        req.log.info({ objectName, size: body.length, backend: "gcs" }, "File saved to GCS");

        res.json({
          objectPath: `/objects/uploads/${id}`,
          metadata: { name, size: body.length, contentType },
        });
      } else {
        // Non-Replit fallback: local disk (ephemeral — configure STORAGE_DIR for persistence)
        const { objectPath, size } = await saveFile(body, name, contentType);
        req.log.info({ objectPath, size, backend: "local" }, "File saved to local disk");
        res.json({ objectPath, metadata: { name, size, contentType } });
      }
    } catch (error) {
      req.log.error({ err: error }, "Error saving uploaded file");
      res.status(500).json({ error: "Failed to upload file" });
    }
  },
);

/**
 * GET /storage/objects/*path
 *
 * Serve a stored file from GCS (Replit) or local disk (fallback).
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    if (gcsAvailable()) {
      const objectFile = await storageService.getObjectEntityFile(objectPath);
      const [metadata] = await objectFile.getMetadata();
      const contentType = (metadata.contentType as string) ?? "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, max-age=3600");
      if (metadata.size) res.setHeader("Content-Length", String(metadata.size));

      objectFile.createReadStream().pipe(res);
    } else {
      const { buffer, meta } = await readFile(objectPath);
      res.setHeader("Content-Type", meta.contentType);
      res.setHeader("Content-Length", String(buffer.length));
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(buffer);
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError || error instanceof FileNotFoundError) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving stored file");
    res.status(500).json({ error: "Failed to serve file" });
  }
});

export default router;
