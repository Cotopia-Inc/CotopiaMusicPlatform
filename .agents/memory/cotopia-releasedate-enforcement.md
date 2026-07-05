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
