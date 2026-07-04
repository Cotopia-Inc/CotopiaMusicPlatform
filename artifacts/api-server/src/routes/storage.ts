import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { randomUUID } from "crypto";
import { objectStorageClient, ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { saveFile, readFile, FileNotFoundError } from "../lib/localFileStorage";
import { r2Available, saveFileToR2, getR2PublicUrl, checkR2Connectivity } from "../lib/r2Storage";

const router: IRouter = Router();
const storageService = new ObjectStorageService();

/**
 * Priority order for storage backends:
 * 1. GCS via Replit Object Storage (dev on Replit)
 * 2. Cloudflare R2 via REST API + public URL (production on Render)
 * 3. Local disk (local dev fallback — ephemeral)
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
 * GET /storage/status  (public — no auth required)
 *
 * Shows which backend is active and whether R2 connectivity is healthy.
 * Hit https://<your-render-url>/api/storage/status to verify your setup.
 */
router.get("/storage/status", async (req: Request, res: Response) => {
  const backend = gcsAvailable() ? "gcs" : r2Available() ? "r2" : "local";
  let r2Check: string | null = null;

  if (backend === "r2") {
    r2Check = await checkR2Connectivity();
  }

  res.json({
    backend,
    r2Configured: r2Available(),
    r2Vars: {
      R2_ACCOUNT_ID: Boolean(process.env.R2_ACCOUNT_ID),
      R2_BUCKET_NAME: Boolean(process.env.R2_BUCKET_NAME),
      R2_API_TOKEN: Boolean(process.env.R2_API_TOKEN),
      R2_PUBLIC_URL: Boolean(process.env.R2_PUBLIC_URL),
    },
    r2ConnectivityError: r2Check,
    r2Healthy: backend === "r2" && r2Check === null,
  });
});

/**
 * POST /storage/uploads/upload
 *
 * Server-mediated upload: browser POSTs the raw file bytes; the server
 * writes them to the appropriate persistent storage backend.
 *
 * Headers:
 *   Content-Type   — file MIME type
 *   X-File-Name    — URL-encoded original filename
 */
// No product-level size cap right now — the video files creators upload can
// be large "one take" recordings. We still set a very high technical ceiling
// (rather than truly unbounded) since express.raw buffers the whole body in
// memory before it reaches the handler; without any ceiling a single garbage
// or malicious request could OOM the process.
router.post(
  "/storage/uploads/upload",
  express.raw({ type: "*/*", limit: "10gb" }),
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
      } else if (r2Available()) {
        const { objectPath, size } = await saveFileToR2(body, name, contentType);
        req.log.info({ objectPath, size, backend: "r2" }, "File saved to Cloudflare R2");
        res.json({ objectPath, metadata: { name, size, contentType } });
      } else {
        const { objectPath, size } = await saveFile(body, name, contentType);
        req.log.info({ objectPath, size, backend: "local" }, "File saved to local disk");
        res.json({ objectPath, metadata: { name, size, contentType } });
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      req.log.error({ err: error, detail }, "Error saving uploaded file");
      res.status(500).json({ error: "File upload failed. Please try again." });
    }
  },
);

/**
 * GET /storage/objects/*path
 *
 * Serve a stored file.
 * - GCS: streams the file through the server
 * - R2:  302-redirects to the public CDN URL — Cloudflare serves the file directly
 * - Local: streams from disk
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
      res.setHeader("Cache-Control", "public, max-age=86400");
      if (metadata.size) res.setHeader("Content-Length", String(metadata.size));

      objectFile.createReadStream().pipe(res);
    } else if (r2Available()) {
      const publicUrl = getR2PublicUrl(objectPath);
      res.redirect(302, publicUrl);
    } else {
      const { buffer, meta } = await readFile(objectPath);
      res.setHeader("Content-Type", meta.contentType);
      res.setHeader("Content-Length", String(buffer.length));
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(buffer);
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError || error instanceof FileNotFoundError) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving stored file");
    res.status(500).json({ error: "Could not retrieve the file. Please try again." });
  }
});

export default router;
