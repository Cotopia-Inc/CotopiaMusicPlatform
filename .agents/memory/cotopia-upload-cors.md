---
name: Cotopia upload CORS fix
description: File uploads failed in browser due to CORS on direct GCS signed-URL PUTs; fixed with server-side proxy endpoint.
---

## Rule
Never have the browser PUT directly to a GCS signed URL. Route all uploads through the API server proxy at `POST /api/storage/uploads/upload`.

**Why:** The Replit GCS sidecar returns real `storage.googleapis.com` signed URLs. `curl` tests pass, but browsers block cross-origin PUTs to GCS. The signed URL worked for reads (proxied through `/api/storage/objects/...`) but not for writes.

**How to apply:** The `useUpload` hook in `@workspace/object-storage-web` now uses a single XHR POST to `/api/storage/uploads/upload`. The server endpoint (`storage.ts`) accepts raw binary via `express.raw({ type: '*/*', limit: '200mb' })`, gets the GCS signed URL server-side, and PUTs the bytes from Node.js. Returns `{ uploadURL, objectPath, metadata }`.

If you need to add another upload entry point (e.g. for video thumbnails), add it to `storage.ts` using the same pattern — do NOT create a new presigned-URL-then-browser-PUT flow.
