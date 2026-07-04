import { randomUUID } from "crypto";

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
 * objectPath  /objects/uploads/<uuid>
 *         →  R2 key  uploads/<uuid>
 */
function objectPathToKey(objectPath: string): string {
  return objectPath.replace(/^\/objects\//, "");
}

const R2_UPLOAD_TIMEOUT_MS = 120_000;
const R2_UPLOAD_MAX_RETRIES = 2; // 3 total attempts
const R2_RETRY_DELAY_MS = [1000, 3000];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Upload a buffer to R2 using Cloudflare's REST API.
 * Uses a Bearer token (global API token) instead of S3-compatible credentials,
 * which avoids the "Invalid character in header" issue with the S3 SDK.
 *
 * Large video uploads (up to 200MB) proxy through this single PUT, so a
 * transient network blip or Cloudflare 5xx would otherwise fail the whole
 * submission. Retry a couple of times with backoff on retryable failures;
 * a hard 120s timeout per attempt prevents a hung request from blocking the
 * whole request indefinitely.
 */
export async function saveFileToR2(
  buffer: Buffer,
  _originalName: string,
  contentType: string,
): Promise<{ objectPath: string; size: number }> {
  const accountId = process.env.R2_ACCOUNT_ID!.trim();
  const bucket = process.env.R2_BUCKET_NAME!.trim();
  const apiToken = process.env.R2_API_TOKEN!.trim();
  const id = randomUUID();
  const key = `uploads/${id}`;

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${key}`;

  let lastError: Error = new Error("R2 upload failed");

  for (let attempt = 0; attempt <= R2_UPLOAD_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": contentType,
        },
        body: buffer,
        signal: AbortSignal.timeout(R2_UPLOAD_TIMEOUT_MS),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const retryable = response.status >= 500;
        const error = new Error(`R2 upload failed (HTTP ${response.status}): ${text}`);
        if (!retryable || attempt === R2_UPLOAD_MAX_RETRIES) throw error;
        lastError = error;
        await sleep(R2_RETRY_DELAY_MS[attempt] ?? 3000);
        continue;
      }

      return { objectPath: `/objects/uploads/${id}`, size: buffer.length };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (attempt === R2_UPLOAD_MAX_RETRIES) throw error;
      lastError = error;
      await sleep(R2_RETRY_DELAY_MS[attempt] ?? 3000);
    }
  }

  throw lastError;
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
