---
name: Cotopia file storage
description: How uploads and file serving work — backend priority chain, R2 setup, env vars, and the Cloudflare REST API approach for production.
---

# Cotopia file storage

## Backend priority chain (artifacts/api-server/src/routes/storage.ts)

1. **GCS** — active on Replit dev when `PRIVATE_OBJECT_DIR` + `DEFAULT_OBJECT_STORAGE_BUCKET_ID` are set
2. **Cloudflare R2** — active on Render prod when `R2_ACCOUNT_ID` + `R2_BUCKET_NAME` + `R2_API_TOKEN` + `R2_PUBLIC_URL` are set
3. **Local disk** — fallback for local dev (ephemeral, not for production)

## Upload endpoints (direct-to-storage with proxy fallback, added 2026-07-04)

Two endpoints, both `requireAuth`:
- `POST /api/storage/uploads/request-url` — returns a presigned PUT URL (`{uploadURL, objectPath, metadata}`): GCS signed URL on dev, R2 S3-compatible presign (via `@aws-sdk/client-s3` + `s3-request-presigner`, needs `R2_S3_ACCESS_KEY_ID`/`R2_S3_SECRET_ACCESS_KEY` — separate from the REST-API `R2_API_TOKEN` used for the proxy path) on Render.
- `POST /api/storage/uploads/upload` — legacy server-proxy route (still used as automatic fallback).

**Canonical hook is `lib/object-storage-web/src/use-upload.ts`** (shared lib, composite — rebuild with `typecheck:libs` after edits), NOT the old app-local duplicate. It tries direct upload first (request-url → XHR PUT straight to storage, browser never sends bytes through the API server) and transparently falls back to the proxy route on any failure (network error, CORS, expired URL, backend not configured for direct upload) — auto-retries network/5xx a couple times with backoff, never retries 4xx. Every call site needs a `getAuthHeaders` option since both routes require auth; `artifacts/cotopia/src/lib/useUpload.ts` is now a thin wrapper that just injects the `cotopia_token` Bearer header — all 6+ page call sites import from that app wrapper, not from `@workspace/object-storage-web` directly.

**Verified in a real browser (not just curl, which bypasses CORS):** direct GCS PUT works with no CORS errors against the dev bucket's default config. R2 presigned PUT direct-upload has NOT been verified in a real browser yet — before relying on it in production, confirm the R2 bucket's CORS policy allows the app's origin for PUT requests (Cloudflare R2 dashboard → bucket → Settings → CORS Policy), since S3-style presigned PUTs are subject to bucket CORS just like GCS.

## R2 S3 SDK — `forcePathStyle: true` is required

Without `forcePathStyle: true` in the `S3Client` constructor, the SDK defaults to virtual-hosted-style addressing (`bucket.accountid.r2.cloudflarestorage.com`). `getSignedUrl` is purely local (no network call) so it silently works without this flag, but any actual HTTP call (`CreateMultipartUploadCommand`, etc.) will throw `ERR_INVALID_CHAR` immediately (0 retries, never makes a network connection). This was the root cause of multipart upload failing in production. **Always set `forcePathStyle: true` for all R2 S3Client instances.**

## R2 setup — Cloudflare REST API (NOT S3/AWS SDK)

**Why REST API, not S3 SDK:** The S3-compatible API requires R2-specific API token key pairs (Access Key ID + Secret). Copy-paste from Cloudflare can introduce invisible Unicode/whitespace characters that cause "Invalid character in header" errors in Node.js's http module. The Cloudflare REST API uses a standard Bearer token that avoids this entirely.

**Upload:** `PUT https://api.cloudflare.com/client/v4/accounts/{accountId}/r2/buckets/{bucket}/objects/{key}`  
**Auth:** `Authorization: Bearer {R2_API_TOKEN}`  
**Serve:** 302 redirect to `{R2_PUBLIC_URL}/{key}` (public development URL from Cloudflare R2 bucket settings)

## Required env vars on Render

| Var | Where to get it |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare dashboard sidebar |
| `R2_BUCKET_NAME` | the bucket name (e.g. "cotopia") |
| `R2_API_TOKEN` | My Profile → API Tokens → token with R2:Edit permission |
| `R2_PUBLIC_URL` | R2 bucket → Settings → Public Development URL (e.g. `https://pub-xxx.r2.dev`) |

Do NOT use `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — those are for the S3 API which has the whitespace bug.

## Diagnostic endpoint

`GET /api/storage/status` — public, no auth. Returns `{backend, r2Healthy, r2ConnectivityError, r2Vars}`.  
Connectivity check hits `GET /client/v4/accounts/{id}/r2/buckets/{bucket}` with the Bearer token.

## objectPath format

`/objects/uploads/<uuid>` — stored in DB, never changes regardless of backend.  
R2 key = `uploads/<uuid>` (strip `/objects/` prefix).  
Stored media URLs = `/api/storage/objects/uploads/<uuid>` (the frontend prepends `/api/storage`).

**Why:**  Durable design — same objectPath format in the DB regardless of which storage backend is active. Swapping backends doesn't require a DB migration.

## Upload reliability (large/slow files, e.g. videos)

**Uploads are fully streamed end-to-end (fixed 2026-07-04) — never buffered fully in memory, and never touch disk on R2.** The upload route no longer uses `express.raw()` (which buffered the whole body into a `Buffer` before the handler ran). It now pipes the incoming request stream through a byte-counting `Transform` straight to the destination:
- GCS: request stream → `file.createWriteStream()` directly (no disk, no memory buffer).
- Local disk: request stream → destination file directly.
- R2: request stream → `https.request()` + `.pipe()` directly into the outgoing PUT to Cloudflare's REST API (`r2Storage.ts`'s `streamingHttpPut`/`saveFileToR2`). Requires `Content-Length` upfront since the body is a single-use stream, not re-readable (no retry-by-resend; a hard timeout guards hangs instead).

**Why this took three attempts — two traps that look fine locally but OOM only on Render:**
1. **`/tmp` on Render is RAM, not disk.** An earlier version of the R2 path staged the upload to a temp file (`os.tmpdir()`) before PUTting to R2, reasoning that R2's REST PUT needs a re-readable/retryable body. Render web services have no persistent disk by default, so temp files under `/tmp` are actually tmpfs (RAM-backed) — writing a large video there OOMs exactly like buffering it in the JS heap would. This is invisible in local dev/tests where `/tmp` is real disk.
2. **`fetch()` buffers Node stream bodies even with `duplex: "half"`.** Replacing the temp-file approach with `fetch(url, { body: nodeStream, duplex: "half" })` looked correct and passed local testing, but undici still buffers the entire stream into memory before/while sending — RSS grew linearly with file size in a direct measurement against a mock server. `duplex: "half"` only satisfies fetch's type contract; it does not give real backpressure. Fix: use raw `https.request()` + `.pipe()`, which does stream with backpressure (verified flat RSS regardless of file size against the same mock server). See `streamingHttpPut` in `r2Storage.ts` and its regression test in `artifacts/api-server/src/__tests__/r2-streaming-upload.test.ts` (tests the same code path against a local plain-HTTP mock server, since `https.request` needs TLS which the test server doesn't have — `http.request`/`https.request` share identical streaming semantics).

**Testing gap that caused repeat failures:** local dev only has GCS credentials configured, so the R2 code path was unverifiable end-to-end locally — both prior bugs "worked" in local/GCS testing and only OOM'd in Render production. Any future R2 upload change should be verified either against real R2 creds or via a local mock HTTP server exercising the actual exported function (not just eyeballing the code), and RSS should be watched directly for large transfers, not inferred from tests passing.

**Raising the size limit is orthogonal and does not fix OOM.** `MAX_UPLOAD_BYTES` in `storage.ts` is a pure technical safety ceiling — raising it (e.g. to 5GB+) does **not** fix an OOM, it only permits larger requests, which makes a buffering bug *more* likely to crash, not less. Memory usage scales with file size only if the file is buffered somewhere (heap, undici's internal buffering, or a tmpfs temp file) — check that the full pipeline streams with real backpressure before touching the limit.

**No product-level file size cap by design (as of 2026-07-04):** `MAX_UPLOAD_BYTES` in `storage.ts` is `10gb`, a pure technical safety ceiling (rejected via a byte-counting Transform mid-stream, not by loading the file) against a garbage/malicious request filling disk — not a real-world restriction. The user explicitly asked for "no size limit" since creators upload large "one take" videos. `submit.tsx`'s client-side `MAX_FILE_SIZE_BYTES` mirrors this same 10GB ceiling. `app.ts` still has a body-parser error handler for other JSON routes' 413s (not used by the streamed upload route anymore, which returns its own JSON 413).

Also fixed earlier: Node's default `server.requestTimeout`/`headersTimeout`/`keepAliveTimeout` were killing large/slow uploads before they could finish. `artifacts/api-server/src/index.ts` sets explicit longer timeouts on the `http.Server`. `useUpload.ts` (client) auto-retries network/5xx failures with backoff (never on 4xx). `r2Storage.ts`'s `saveFileToR2` itself cannot retry mid-upload (the request body is a single-use stream, not a re-readable buffer/file) — a hard timeout on the outgoing `https.request` guards against a hung connection instead.

## Large-file upload: requires R2 S3 HMAC credentials for multipart (2026-07-11)

Server-side S3 multipart upload was added as the path for files ≥ 100 MB
(browser POSTs 50 MB chunks to `/multipart/part`, server calls `UploadPartCommand`).
This requires **`R2_S3_ACCESS_KEY_ID`** and **`R2_S3_SECRET_ACCESS_KEY`** in Render —
separate from the REST-API `R2_API_TOKEN`. Without them, `/multipart/start` returns
501 and large files silently cycle through all three fallback paths, holding
`isUploading=true` at 0% for 4-5 seconds before finally showing a generic error.

**Key fixes shipped:**
- `isRetryable` now treats 501 as non-retryable — retrying a missing-config error wastes time.
- `attemptUpload` tracks `multipartUnavailable`; when both multipart and presign return
  501 **and** the file is ≥ MULTIPART_THRESHOLD, it throws immediately with a clear
  actionable message instead of letting the proxy attempt play out.
- All S3 SDK calls (`CreateMultipartUploadCommand`, `UploadPartCommand`) are wrapped in
  `withTimeout()` so a slow/unreachable R2 endpoint doesn't hang the server indefinitely.
- Proxy route catch now detects `"HTTP 413"` from Cloudflare REST API and returns 413
  (not 500) to the client; 413 is non-retryable so the error appears immediately.

**How to get R2 HMAC keys** (Cloudflare dashboard → R2 → Manage API tokens → Create API token
with "Object Read & Write" on the bucket → copy Access Key ID and Secret Access Key).

## Render production gotcha: repo's `.node-version` says `22`, dev container runs Node 24

Render's `runtime: node` in `render.yaml` picks up the repo-root `.node-version` file to choose the Node version, which is pinned to `22` — but this Replit dev container runs Node 24. Code that only gets exercised on Render (not locally) should be checked for Node 22 compatibility, since a local build/typecheck pass does not guarantee the same behavior on Render's actual runtime version.
