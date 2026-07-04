import { describe, it, expect } from "vitest";
import { S3Client } from "@aws-sdk/client-s3";
import { presignR2Upload } from "../lib/r2Storage";

/**
 * `presignR2Upload` generates a presigned PUT URL for the direct-to-browser
 * upload path. SigV4 presigning is pure computation against the client's
 * config (credentials + endpoint) — it makes no network call — so this can
 * be asserted offline with fake-but-well-formed credentials and an injected
 * S3Client, without touching real Cloudflare infrastructure.
 */
describe("presignR2Upload", () => {
  const testClient = new S3Client({
    region: "auto",
    endpoint: "https://test-account-id.r2.cloudflarestorage.com",
    credentials: {
      accessKeyId: "TESTACCESSKEYID",
      secretAccessKey: "TESTSECRETACCESSKEYVALUE",
    },
  });

  const originalBucket = process.env.R2_BUCKET_NAME;

  it("produces a SigV4-signed URL against the R2 S3-compatible endpoint", async () => {
    process.env.R2_BUCKET_NAME = "test-bucket";

    const { uploadURL, objectPath } = await presignR2Upload("video/mp4", testClient);

    const parsed = new URL(uploadURL);
    expect(parsed.hostname).toBe("test-bucket.test-account-id.r2.cloudflarestorage.com");
    expect(parsed.pathname).toBe(objectPath.replace("/objects", ""));
    expect(parsed.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(parsed.searchParams.get("X-Amz-Credential")).toContain("TESTACCESSKEYID");
    expect(parsed.searchParams.get("X-Amz-Signature")).toBeTruthy();
    expect(parsed.searchParams.get("X-Amz-Expires")).toBe("900");

    expect(objectPath).toMatch(/^\/objects\/uploads\/[0-9a-f-]{36}$/);

    process.env.R2_BUCKET_NAME = originalBucket;
  });

  it("generates a unique objectPath on each call", async () => {
    process.env.R2_BUCKET_NAME = "test-bucket";

    const a = await presignR2Upload("image/png", testClient);
    const b = await presignR2Upload("image/png", testClient);
    expect(a.objectPath).not.toBe(b.objectPath);

    process.env.R2_BUCKET_NAME = originalBucket;
  });
});
