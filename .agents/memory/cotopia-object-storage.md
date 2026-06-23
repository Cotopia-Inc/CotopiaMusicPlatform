---
name: Cotopia object storage setup
description: How file uploads are wired in Cotopia — server-proxy upload flow, hook usage, serving URLs, and key gotchas.
---

## Architecture (WORKING approach)

Single-step server-proxy upload:
1. Client POSTs raw file bytes to `POST /api/storage/uploads/upload` with `Content-Type` and `X-File-Name` headers
2. Server receives bytes, signs a GCS URL internally, streams bytes to GCS, returns `{ uploadURL, objectPath, metadata }`
3. Store `objectPath` in DB; serve via `GET /api/storage/objects/<path>`

**Why not 2-step presigned URL (browser → GCS directly)?**
The 2-step approach (POST /request-url → XHR/fetch PUT to storage.googleapis.com) fails
silently in the Replit browser preview environment. curl/Node.js simulations work fine,
GCS CORS is `*`, but browser PUT to GCS consistently fails. Root cause never isolated.
Server proxy confirmed working for 5MB and 50MB files; limit is 200MB via express.raw.

Serving URL pattern: `/api/storage` + `objectPath`
- e.g. `objectPath = "/objects/uploads/some-uuid"` → serve at `/api/storage/objects/uploads/some-uuid`

## Client usage (current)

`artifacts/cotopia/src/lib/useUpload.ts` — local hook (NOT from @workspace/object-storage-web):
```ts
import { useUpload } from "../lib/useUpload";

const { uploadFile, isUploading, progress, error } = useUpload({
  onSuccess: (res) => {
    setUrl(`/api/storage${res.objectPath}`);
  },
});
```

The hook uses XHR POST to `/api/storage/uploads/upload` with progress tracking via `xhr.upload.onprogress`.
`upload.error.message` is now displayed below the Retry button in all three upload pages.

## Known type fix

`artifacts/api-server/src/lib/objectStorage.ts`:
```ts
const { signed_url: signedURL } = await response.json() as { signed_url: string };
```

## Pages with uploads

- `artifacts/cotopia/src/pages/submit.tsx` — FileRow components (audio + cover art)
- `artifacts/cotopia/src/pages/admin-upload-song.tsx` — SongRow + cover
- `artifacts/cotopia/src/pages/admin-upload-video.tsx` — VideoRow + thumbnail

All three import `useUpload` from `../lib/useUpload` (local copy, NOT the lib package).
The lib package `lib/object-storage-web/src/use-upload.ts` is stale — do not use it for uploads.

## Package locations

- Server lib: `artifacts/api-server/src/lib/objectStorage.ts`, `objectAcl.ts`
- Server route: `artifacts/api-server/src/routes/storage.ts` — `/upload` and `/request-url` endpoints
- Local client hook: `artifacts/cotopia/src/lib/useUpload.ts`
