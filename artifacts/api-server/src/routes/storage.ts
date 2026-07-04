import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { createWriteStream } from "fs";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import { objectStorageClient, ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import {
  readFile,
  FileNotFoundError,
  beginLocalUpload,
  finalizeLocalUpload,
} from "../lib/localFileStorage";
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

// No product-level size cap right now — the video files creators upload can
// be large "one take" recordings. We still set a very high technical ceiling
// (rather than truly unbounded) so a single garbage/malicious request can't
// fill the disk or run forever.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 * 1024; // 10GB

class UploadTooLargeError extends Error {
  constructor() {
    super("UPLOAD_TOO_LARGE");
    this.name = "UploadTooLargeError";
  }
}

/**
 * Counts bytes as they pass through and errors out once the configured
 * ceiling is exceeded — this lets us reject an oversized upload mid-stream
 * without ever holding the whole file in memory.
 */
class ByteLimitTransform extends Transform {
  private total = 0;

  constructor(private readonly maxBytes: number) {
    super();
  }

  get bytesRead(): number {
    return this.total;
  }

  _transform(chunk: Buffer, _encoding: string, callback: (error?: Error | null, data?: Buffer) => void): void {
    this.total += chunk.length;
    if (this.total > this.maxBytes) {
      callback(new UploadTooLargeError());
      return;
    }
    callback(null, chunk);
  }
}

/**
 * POST /storage/uploads/upload
 *
 * Server-mediated upload: browser POSTs the raw file bytes; the server
 * streams them straight through to the appropriate persistent storage
 * backend without ever buffering the whole file in memory. Buffering large
 * video uploads in memory (the previous `express.raw()` approach) could OOM
 * and crash memory-constrained instances (e.g. Render's starter plan).
 *
 * Headers:
 *   Content-Type   — file MIME type
 *   X-File-Name    — URL-encoded original filename
 */
router.post("/storage/uploads/upload", async (req: Request, res: Response) => {
  const rawName = req.headers["x-file-name"];
  const name = rawName
    ? decodeURIComponent(Array.isArray(rawName) ? rawName[0] : rawName)
    : "upload";
  const contentType =
    (Array.isArray(req.headers["content-type"])
      ? req.headers["content-type"][0]
      : req.headers["content-type"]) ?? "application/octet-stream";

  const contentLengthHeader = req.headers["content-length"];
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
    res.status(413).json({ error: "File is too large. Maximum upload size is 10GB." });
    return;
  }
  if (Number.isFinite(contentLength) && contentLength === 0) {
    res.status(400).json({ error: "No file data provided" });
    return;
  }

  const limiter = new ByteLimitTransform(MAX_UPLOAD_BYTES);

  try {
    if (gcsAvailable()) {
      const id = randomUUID();
      const privateDir = storageService.getPrivateObjectDir();
      const fullPath = `${privateDir}/uploads/${id}`;
      const { bucketName, objectName } = parseBucketPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      const writeStream = file.createWriteStream({ contentType, metadata: { originalName: name } });

      await pipeline(req, limiter, writeStream);
      const size = limiter.bytesRead;
      req.log.info({ objectName, size, backend: "gcs" }, "File saved to GCS");

      res.json({
        objectPath: `/objects/uploads/${id}`,
        metadata: { name, size, contentType },
      });
    } else if (r2Available()) {
      // Render web services have no persistent disk by default — os.tmpdir()
      // is backed by container RAM there, so staging the upload to a temp
      // file would just recreate the in-memory-buffering OOM under a
      // different name. Instead, pipe the request straight into the
      // outgoing PUT to R2 without ever landing it on disk. This requires
      // knowing the exact size upfront (R2's single-PUT REST API needs a
      // real Content-Length), which the browser's XHR upload always sends.
      if (!Number.isFinite(contentLength)) {
        res.status(400).json({ error: "A Content-Length header is required for this upload." });
        return;
      }
      req.on("error", (err) => limiter.destroy(err));
      req.pipe(limiter);
      const { objectPath } = await saveFileToR2(limiter, contentLength, contentType);
      const size = limiter.bytesRead;
      if (size !== contentLength) {
        req.log.warn({ objectPath, declared: contentLength, actual: size }, "R2 upload size mismatch");
      }
      req.log.info({ objectPath, size, backend: "r2" }, "File saved to Cloudflare R2");
      res.json({ objectPath, metadata: { name, size, contentType } });
    } else {
      const { id, filePath } = await beginLocalUpload();
      await pipeline(req, limiter, createWriteStream(filePath));
      const size = limiter.bytesRead;
      const { objectPath } = await finalizeLocalUpload(id, name, contentType, size);
      req.log.info({ objectPath, size, backend: "local" }, "File saved to local disk");
      res.json({ objectPath, metadata: { name, size, contentType } });
    }
  } catch (error: unknown) {
    // If the outgoing upload (to R2, or the local write stream) fails or is
    // rejected mid-transfer, make sure we stop reading from the client too —
    // otherwise the browser keeps sending into a dead pipe until it finishes
    // or a timeout fires, holding the connection open for no reason.
    if (!req.destroyed) req.destroy();

    if (error instanceof UploadTooLargeError) {
      res.status(413).json({ error: "File is too large. Maximum upload size is 10GB." });
      return;
    }
    const detail = error instanceof Error ? error.message : String(error);
    req.log.error({ err: error, detail }, "Error saving uploaded file");
    res.status(500).json({ error: "File upload failed. Please try again." });
  }
});

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
