---
name: Cotopia object storage setup
description: How file uploads are wired in Cotopia — GCS presigned URL flow, hook usage, serving URLs, and a known type fix.
---

## Architecture

Two-step presigned URL flow:
1. Client POSTs JSON metadata to `POST /api/storage/uploads/request-url` → gets `{ uploadURL, objectPath }`
2. Client PUTs file bytes directly to `uploadURL` (GCS)
3. Store `objectPath` in DB; serve via `GET /api/storage/objects/<path>`

Serving URL pattern: `/api/storage` + `objectPath`
- e.g. `objectPath = "/objects/uploads/some-uuid"` → serve at `/api/storage/objects/uploads/some-uuid`

## Client usage

```ts
import { useUpload } from "@workspace/object-storage-web";

const { uploadFile, isUploading, progress } = useUpload({
  onSuccess: (res) => {
    setUrl(`/api/storage${res.objectPath}`);
  },
});
```

## Known type fix

`artifacts/api-server/src/lib/objectStorage.ts` line ~268:
```ts
// Must cast — response.json() returns unknown
const { signed_url: signedURL } = await response.json() as { signed_url: string };
```

## Pages with real uploads

- `submit.tsx` — audio/video file + cover art (FileUploadField component)
- `profile.tsx` — avatar photo
- `admin-settings.tsx` — logo image (also keeps URL text fallback)

**Why:** All three previously used `URL.createObjectURL()` producing blob URLs that break on reload or when accessed by another user.

## Package locations

- Server lib: `artifacts/api-server/src/lib/objectStorage.ts`, `objectAcl.ts`
- Server route: `artifacts/api-server/src/routes/storage.ts`
- Client lib: `lib/object-storage-web/` (composite lib, referenced in root tsconfig.json and artifacts/cotopia/tsconfig.json)
- Uppy deps installed in: `artifacts/cotopia` (dependencies, not devDependencies)
