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
