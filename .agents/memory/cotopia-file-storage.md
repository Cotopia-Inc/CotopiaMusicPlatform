---
name: Cotopia file storage
description: How uploads and file serving work — backend priority chain, R2 setup, env vars, and the Cloudflare REST API approach for production.
---

# Cotopia file storage

## Backend priority chain (artifacts/api-server/src/routes/storage.ts)

1. **GCS** — active on Replit dev when `PRIVATE_OBJECT_DIR` + `DEFAULT_OBJECT_STORAGE_BUCKET_ID` are set
2. **Cloudflare R2** — active on Render prod when `R2_ACCOUNT_ID` + `R2_BUCKET_NAME` + `R2_API_TOKEN` + `R2_PUBLIC_URL` are set
3. **Local disk** — fallback for local dev (ephemeral, not for production)

## Upload endpoint

`POST /api/storage/uploads/upload`  
Frontend hook: `artifacts/cotopia/src/lib/useUpload.ts` (NOT `@workspace/object-storage-web`)  
The hook sends raw bytes with `Content-Type` and `X-File-Name` headers; server writes to the active backend.

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

**Uploads are fully streamed end-to-end (fixed 2026-07-04) — never buffered fully in memory.** The upload route no longer uses `express.raw()` (which buffered the whole body into a `Buffer` before the handler ran). It now pipes the incoming request stream through a byte-counting `Transform` straight to the destination:
- GCS: request stream → `file.createWriteStream()` directly (no disk, no memory buffer).
- Local disk: request stream → destination file directly.
- R2: request stream → temp file on disk first (R2's REST PUT needs a re-readable body to retry), then the temp file is streamed to R2 via `fetch(..., { body: createReadStream(path), duplex: "half" })`, and deleted afterward.

**Why this was a hard requirement, not just an optimization:** buffering the whole file in memory OOM-crashed the Render production instance ("Ran out of memory (used over 512MB)") on a real user upload. Raising the `express.raw` size limit (e.g. to 5GB) does **not** fix an OOM — it only permits larger requests, which makes the crash *more* likely, not less, since the crash is caused by how much of the file sits in RAM at once, not by the configured ceiling. Any future "raise the limit" request for this endpoint should be met with: memory usage scales with file size only if it's buffered — check that streaming is still in place before touching the limit.

**No product-level file size cap by design (as of 2026-07-04):** `MAX_UPLOAD_BYTES` in `storage.ts` is `10gb`, a pure technical safety ceiling (rejected via a byte-counting Transform mid-stream, not by loading the file) against a garbage/malicious request filling disk — not a real-world restriction. The user explicitly asked for "no size limit" since creators upload large "one take" videos. `submit.tsx`'s client-side `MAX_FILE_SIZE_BYTES` mirrors this same 10GB ceiling. `app.ts` still has a body-parser error handler for other JSON routes' 413s (not used by the streamed upload route anymore, which returns its own JSON 413).

Also fixed earlier: Node's default `server.requestTimeout`/`headersTimeout`/`keepAliveTimeout` were killing large/slow uploads before they could finish. `artifacts/api-server/src/index.ts` sets explicit longer timeouts on the `http.Server`. `useUpload.ts` (client) auto-retries network/5xx failures with backoff (never on 4xx); `r2Storage.ts`'s `saveFileToR2` retries+times-out (`AbortSignal.timeout`) the Cloudflare PUT itself.

## Render production gotcha: repo's `.node-version` says `22`, dev container runs Node 24

Render's `runtime: node` in `render.yaml` picks up the repo-root `.node-version` file to choose the Node version, which is pinned to `22` — but this Replit dev container runs Node 24. Code that only gets exercised on Render (not locally) should be checked for Node 22 compatibility, since a local build/typecheck pass does not guarantee the same behavior on Render's actual runtime version.
