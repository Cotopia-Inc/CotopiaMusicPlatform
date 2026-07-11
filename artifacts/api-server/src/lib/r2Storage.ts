import { randomUUID } from "crypto";
import https from "https";
import type { Readable } from "stream";
import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Returns true when Cloudflare R2 is configured via REST API + public URL.
 * Required env vars (set in Render):
 *   R2_ACCOUNT_ID  — Cloudflare account ID
 *   R2_BUCKET_NAME — R2 bucket name (e.g. "cotopia")
 *   R2_API_TOKEN   — Cloudflare global API token with R2:Edit permission
 *   R2_PUBLIC_URL  — public development URL (e.g. https://pub-xxx.r2.dev)
 */
export function r2Available(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_API_TOKEN &&
    process.env.R2_PUBLIC_URL,
  );
}

/**
 * Returns true when R2 is ALSO configured for direct-to-browser presigned
 * uploads. This is a separate, optional credential from `r2Available()`'s
 * Bearer-token REST API creds — presigned URLs are an S3-compatible-API
 * feature and need HMAC access keys (Cloudflare dashboard: R2 API token
 * with "Object Read & Write" S3-compatible permissions), not a Bearer
 * token. The Bearer-token path (saveFileToR2, checkR2Connectivity) keeps
 * working unconditionally regardless of whether this is set — this is
 * purely an additive speed optimization, not a replacement.
 */
export function r2PresignAvailable(): boolean {
  return Boolean(
    r2Available() &&
    process.env.R2_S3_ACCESS_KEY_ID &&
    process.env.R2_S3_SECRET_ACCESS_KEY,
  );
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Client) return s3Client;
  const accountId = process.env.R2_ACCOUNT_ID!.trim();
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_S3_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.R2_S3_SECRET_ACCESS_KEY!.trim(),
    },
  });
  return s3Client;
}

const PRESIGN_TTL_SEC = 900;
const PRESIGN_PART_TTL_SEC = 3600; // 1 hour — generous for slow connections

/**
 * Generates a presigned PUT URL the browser can upload directly to, bypassing
 * the API server entirely for the actual file bytes. Injectable S3 client so
 * this can be unit-tested offline (SigV4 presigning is pure computation —
 * no network call is made to generate the URL, only to use it).
 */
export async function presignR2Upload(
  contentType: string,
  client: S3Client = getS3Client(),
): Promise<{ uploadURL: string; objectPath: string }> {
  const bucket = process.env.R2_BUCKET_NAME!.trim();
  const id = randomUUID();
  const key = `uploads/${id}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadURL = await getSignedUrl(client, command, { expiresIn: PRESIGN_TTL_SEC });

  return { uploadURL, objectPath: `/objects/uploads/${id}` };
}

/**
 * objectPath  /objects/uploads/<uuid>
 *         →  R2 key  uploads/<uuid>
 */
function objectPathToKey(objectPath: string): string {
  return objectPath.replace(/^\/objects\//, "");
}

const R2_UPLOAD_TIMEOUT_MS = 120_000;

type RequestFn = typeof https.request;

/**
 * Pipes `body` into an HTTP(S) request created via `requestFn` and resolves
 * once a 2xx response is fully received, or rejects on any error/non-2xx.
 *
 * `requestFn` is injected (defaults to `https.request` in production) so
 * this can be exercised in tests against a plain local `http` server without
 * needing a TLS endpoint — `http.request` and `https.request` share the same
 * streaming/backpressure semantics, only the transport differs.
 *
 * Two memory traps had to be avoided here, both confirmed by direct
 * measurement against a local test server before landing this:
 *
 * 1. Staging the upload to a temp file first. Render web services (and many
 *    other PaaS containers) have no persistent disk by default —
 *    `os.tmpdir()` / `/tmp` is backed by the container's RAM, so writing a
 *    large video there consumes memory exactly like buffering it in the JS
 *    heap would, and can still OOM a 512MB instance even though the Node
 *    process's own heap/RSS looks flat.
 * 2. Using the global `fetch()` (undici) with a Node stream as the body.
 *    Despite `duplex: "half"`, undici buffers the entire stream into memory
 *    before/while sending it — RSS grows linearly with file size exactly
 *    like the original `express.raw()` bug. `duplex: "half"` only satisfies
 *    fetch's API contract, it does not make undici stream the body with
 *    real backpressure. Raw `https.request()` + `.pipe()`, by contrast,
 *    streams with real backpressure and keeps RSS flat regardless of file
 *    size — verified locally against a mock endpoint.
 *
 * Trade-off: because the source is a live, single-use request stream (not a
 * re-readable file), a failed upload cannot be retried by re-sending the
 * same bytes — retrying would require buffering, which is the exact thing
 * we're avoiding. A hard timeout still guards against a hung request.
 */
export function streamingHttpPut(
  requestFn: RequestFn,
  options: https.RequestOptions,
  body: Readable,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const MAX_ERROR_BODY_BYTES = 4096;
    const req = requestFn(options, (res) => {
      let responseBody = "";
      res.on("data", (chunk: Buffer) => {
        if (responseBody.length < MAX_ERROR_BODY_BYTES) {
          responseBody += chunk.toString("utf8");
        }
      });
      res.on("end", () => {
        const status = res.statusCode ?? 0;
        if (status >= 200 && status < 300) {
          settle(resolve);
        } else {
          settle(() =>
            reject(new Error(`Upload failed (HTTP ${status}): ${responseBody}`)),
          );
        }
      });
    });

    req.on("timeout", () => req.destroy(new Error("Upload timed out")));
    req.on("error", (err) => settle(() => reject(err)));
    body.on("error", (err) => {
      settle(() => reject(err));
      req.destroy(err);
    });

    body.pipe(req);
  });
}

/**
 * Upload a file to R2 using Cloudflare's REST API, streaming the incoming
 * request body straight through to R2 — never touching local disk or
 * buffering it in a Node Buffer. See `streamingHttpPut` for why this uses
 * raw `https.request()` instead of `fetch()`.
 */
export async function saveFileToR2(
  body: Readable,
  size: number,
  contentType: string,
): Promise<{ objectPath: string; size: number }> {
  const accountId = process.env.R2_ACCOUNT_ID!.trim();
  const bucket = process.env.R2_BUCKET_NAME!.trim();
  const apiToken = process.env.R2_API_TOKEN!.trim();
  const id = randomUUID();
  const key = `uploads/${id}`;
  const path = `/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${key}`;

  await streamingHttpPut(
    https.request,
    {
      hostname: "api.cloudflare.com",
      path,
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": contentType,
        "Content-Length": size,
      },
      timeout: R2_UPLOAD_TIMEOUT_MS,
    },
    body,
  );

  return { objectPath: `/objects/uploads/${id}`, size };
}

/**
 * Returns the public CDN URL for a stored object.
 * Uses R2's public development URL — no presigned URLs or expiry needed.
 */
export function getR2PublicUrl(objectPath: string): string {
  const publicBase = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");
  const key = objectPathToKey(objectPath);
  return `${publicBase}/${key}`;
}

/**
 * Initiates a multipart upload and returns the uploadId + objectPath.
 * The caller must follow up with presignR2UploadPart for each part and then
 * completeR2MultipartUpload once all parts have been PUT by the browser.
 */
export async function initiateR2MultipartUpload(
  contentType: string,
  client: S3Client = getS3Client(),
): Promise<{ uploadId: string; objectPath: string }> {
  const bucket = process.env.R2_BUCKET_NAME!.trim();
  const id = randomUUID();
  const key = `uploads/${id}`;

  const command = new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const result = await client.send(command);
  if (!result.UploadId) throw new Error("R2 did not return an upload ID");

  return { uploadId: result.UploadId, objectPath: `/objects/uploads/${id}` };
}

/**
 * Generates a presigned PUT URL for a single multipart part. The browser uses
 * this to PUT the chunk directly to R2; the ETag from R2's response is then
 * collected for the final CompleteMultipartUpload call.
 */
export async function presignR2UploadPart(
  objectPath: string,
  uploadId: string,
  partNumber: number,
  client: S3Client = getS3Client(),
): Promise<string> {
  const bucket = process.env.R2_BUCKET_NAME!.trim();
  const key = objectPathToKey(objectPath);

  const command = new UploadPartCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  return getSignedUrl(client, command, { expiresIn: PRESIGN_PART_TTL_SEC });
}

/**
 * Finalises a multipart upload. `parts` must be sorted by partNumber ascending
 * and each ETag must be exactly as returned by R2 (including surrounding quotes).
 */
export async function completeR2MultipartUpload(
  objectPath: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>,
  client: S3Client = getS3Client(),
): Promise<void> {
  const bucket = process.env.R2_BUCKET_NAME!.trim();
  const key = objectPathToKey(objectPath);

  const command = new CompleteMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
    },
  });

  await client.send(command);
}

/**
 * Aborts an in-progress multipart upload, releasing any stored parts.
 * Best-effort cleanup — callers should swallow errors from this.
 */
export async function abortR2MultipartUpload(
  objectPath: string,
  uploadId: string,
  client: S3Client = getS3Client(),
): Promise<void> {
  const bucket = process.env.R2_BUCKET_NAME!.trim();
  const key = objectPathToKey(objectPath);

  const command = new AbortMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
  });

  await client.send(command);
}

/**
 * Quick connectivity check — does a HEAD request to the API to verify the
 * token is valid and the bucket exists. Returns null on success, error string on failure.
 */
export async function checkR2Connectivity(): Promise<string | null> {
  try {
    const accountId = process.env.R2_ACCOUNT_ID!.trim();
    const bucket = process.env.R2_BUCKET_NAME!.trim();
    const apiToken = process.env.R2_API_TOKEN!.trim();

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}`;
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${apiToken}` },
    });

    if (response.ok) return null;

    const text = await response.text().catch(() => "");
    return `HTTP ${response.status}: ${text.slice(0, 200)}`;
  } catch (err: unknown) {
    return String(err);
  }
}
