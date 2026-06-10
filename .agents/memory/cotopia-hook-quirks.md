---
name: Cotopia hook and schema quirks
description: Non-obvious API shape and hook behaviour to watch for in the Cotopia frontend
---

## useUpload (object-storage-web)
Callback is `onSuccess`, not `onChange` or `onUpload`:
```ts
const upload = useUpload({ onSuccess: (res) => setUrl(`/api/storage${res.objectPath}`) });
```
**Why:** The UseUploadOptions interface only exposes `onSuccess`, `onError`, and `basePath`.

## useListArtists return shape
Returns `Artist[]` directly — no `{ items, total }` wrapper:
```ts
const { data } = useListArtists({});
const artists = data ?? []; // NOT data?.items
```
**Why:** Artists endpoint is one of the plain-array endpoints (not paginated).

## Conditional Orval hooks need queryKey
When passing `enabled` to an Orval-generated hook's `query` options, TypeScript requires `queryKey` too:
```ts
import { getGetEditorialPlaylistQueryKey } from "@workspace/api-client-react";
const id = selectedId ?? 0;
useGetEditorialPlaylist(id, {
  query: { enabled: !!selectedId, queryKey: getGetEditorialPlaylistQueryKey(id) }
});
```
**Why:** Orval emits `UseQueryOptions` which marks `queryKey` as required in TanStack Query v5.

## AnalyticsEventInputContentType enum
Only accepts `'song' | 'video' | 'playlist' | 'user'` — `'artist'` is not valid:
```ts
// Wrong: contentType: "artist"
// Right: contentType: "user" (use artist's ID as contentId)
```
**Why:** OpenAPI spec enum for analytics event input is limited to these four values.

## follows table columns
Uses `targetType` and `targetId` (not `followeeType`/`followeeId`):
```ts
eq(followsTable.targetType, "artist"), eq(followsTable.targetId, artistId)
```
**Why:** DB schema defines the columns as `target_type` / `target_id`.

## api-server zod import
`api-server` does not have `zod` in its package.json by default — use `catalog:` to add it if a new route needs inline `z` schemas. Use `from "zod"` (not `"zod/v4"`).
**Why:** api-server only pulls in zod transitively via `@workspace/api-zod`; `"zod/v4"` is the subpath export for the Zod v4 API but TypeScript can't resolve it without an explicit dep.

## JwtPayload shape
`req.user` only has `{ userId: number; role: string }` — no `username`. Look up the username from DB if needed:
```ts
const row = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
```
