---
name: Cotopia releaseDate enforcement scope
description: Where releaseDate/status gating must be applied for songs & videos, and where it's intentionally skipped
---

Every query that surfaces published songs/videos to end users must gate on both
`status: "published"` AND `releaseDate` (via `or(isNull(releaseDate), lte(releaseDate, CURRENT_DATE))`),
not just status — admins can approve/publish early with a future releaseDate, and the scheduler
(publisher.ts) is what flips status at release time, but any query bypassing that gate leaks
early content.

**Why:** this gate was missing in home.ts (featured/trending/new-releases/editor-picks),
artists.ts (profile song/video lists, counts), and labels.ts (artist song counts,
recentReleases) even though the primary listing routes (songs.ts/videos.ts/discover.ts) had it.
Also, the `GET /songs/:id` and `GET /videos/:id` detail-by-id routes had NO status/releaseDate
check at all — any authenticated user could fetch/stream unreleased content by ID even though
it never appeared in any list. Fixed by checking `status==="published" && released` in the
route handler and allowing only staff (admin/master_admin/editor/moderator) or the owning
artist to bypass (404 for everyone else, so existence isn't leaked either).

**How to apply:** when adding any new query/endpoint that lists or fetches songs/videos for
end users, always include the releaseDate gate unless the endpoint is explicitly an
owner/staff-only surface (own library/history, own analytics, submissions review, admin stats,
editor-picks admin selection). User-owned collections (favorites, playlists, library/history)
don't independently re-filter by status/releaseDate — this is accepted as-is since users can
only add items to those from surfaces that were already gated when added.

**Write-side gate (publish pipeline), added Jul 2026 for songs AND videos symmetrically:**
reading gates aren't enough — any code path that can *write* `status: "published"` must also
check the releaseDate before doing so, or approved-but-future content leaks the moment anyone
flips its status. `publishContent()` in publisher.ts is the single choke point (used by the
scheduler and by admin-approval flows) and now re-fetches the row's own releaseDate and refuses
to publish (keeps status "approved") if it's in the future — exported `isFutureRelease(releaseDate)`
helper is the shared source of truth for the date comparison. Found and closed 3 separate bypass
vectors that skipped this choke point entirely: (1) legacy `PATCH /submissions/:id` with
`{status:"published"}` called publishContent directly with no date check — fixed by redirecting
the requested status to "approved" when the resolved release date (from submitterNotes JSON or
the live content row) is future; (2) `PATCH /songs/:id` and (3) `PATCH /videos/:id` let any
owner/admin set `status:"published"` directly via a raw `db.update(...).set(parsed.data)` with
zero gating — fixed by rejecting the request with 409 (not silently downgrading — the update
schemas for these endpoints don't even include "approved" as a valid enum value, so downgrade
isn't type-safe) when status is "published" and the existing row's releaseDate is future.
Any *new* write path that can set a song/video to "published" must call `isFutureRelease` (or
route through `publishContent`) or it will reopen this leak.

**Timezone (added Jul 2026): all releaseDate comparisons use US Eastern Time, not UTC.**
`lib/timezone.ts` exports `RELEASE_TIMEZONE = "America/New_York"` and `getTodayInReleaseTimezone()`
(computed via `Date.toLocaleDateString("en-CA", {timeZone: ...})` for a `YYYY-MM-DD` string).
**Why:** `sql\`CURRENT_DATE\`` runs Postgres-side and follows the DB session timezone (UTC in this
env), so simply "switching to ET" isn't a one-line config change — every comparison that used the
SQL literal had to move to a JS-computed ET date bound as a query parameter instead. Module-level
consts computed once at import time (e.g. old `home.ts`/`artists.ts`/`labels.ts` pattern) are also
wrong for this because "today" must be recomputed per-request, not frozen at server boot.
**How to apply:** any new/changed releaseDate comparison (reads or writes) must call
`getTodayInReleaseTimezone()` fresh at request time — never `sql\`CURRENT_DATE\`` and never a
module-level `new Date()`/`toISOString().slice(0,10)` const. A user-facing note ("goes live at
12:00 AM ET on this date") was added next to every releaseDate picker (submit.tsx,
admin-upload-song.tsx, admin-upload-video.tsx, including bulk variants).
