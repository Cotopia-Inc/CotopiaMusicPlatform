import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

/**
 * Returns true when Cloudflare R2 credentials are configured.
 * Set these env vars in Render (or any non-Replit host):
 *   R2_ACCOUNT_ID        — Cloudflare account ID
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret key
 *   R2_BUCKET_NAME       — bucket name (e.g. "cotopia")
 */
export function r2Available(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME,
  );
}

function getClient(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function getBucket(): string {
  return process.env.R2_BUCKET_NAME!;
}

/**
 * objectPath  /objects/uploads/<uuid>
 *         →  R2 key  uploads/<uuid>
 */
function objectPathToKey(objectPath: string): string {
  return objectPath.replace(/^\/objects\//, "");
}

/**
 * Upload a buffer to R2. Returns the same objectPath format used throughout
 * the app (/objects/uploads/<uuid>) so the DB schema doesn't change.
 */
export async function saveFileToR2(
  buffer: Buffer,
  originalName: string,
  contentType: string,
): Promise<{ objectPath: string; size: number }> {
  const client = getClient();
  const bucket = getBucket();
  const id = randomUUID();
  const key = `uploads/${id}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: { originalName: encodeURIComponent(originalName) },
    }),
  );

  return { objectPath: `/objects/uploads/${id}`, size: buffer.length };
}

/**
 * Generate a presigned GET URL for a stored object.
 * Expires in 7 days — long enough for streaming sessions without
 * needing to re-sign constantly.
 */
export async function getR2SignedUrl(objectPath: string): Promise<string> {
  const client = getClient();
  const bucket = getBucket();
  const key = objectPathToKey(objectPath);

  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: 604800 });
}
