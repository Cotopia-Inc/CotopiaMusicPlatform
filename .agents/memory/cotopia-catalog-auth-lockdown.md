---
name: Cotopia catalog API locked down
description: Catalog GET endpoints (songs, videos, artists, labels, discover, home, company, editorial-playlists, editor-picks) require full authentication, not public/optionalAuth access.
---

As of July 2026, all catalog-listing GET endpoints require `requireAuth` (a valid JWT), not `optionalAuth` or unauthenticated access:
- songs.ts: `/songs`, `/songs/featured`, `/songs/trending`, `/songs/:id`, `/songs/:id/comments`
- videos.ts: `/videos`, `/videos/featured`, `/videos/trending`, `/videos/:id`, `/videos/:id/comments`
- artists.ts: `/artists`, `/artists/new`, `/artists/featured`, `/artists/:id`
- labels.ts: `/labels`, `/labels/featured`, `/labels/:id`
- discover.ts: `/discover`
- home.ts: `/home`
- company.ts: `/company/posts`, `/company/posts/:id`, `/ceo-message`
- editorial-playlists.ts: `/editorial-playlists`, `/editorial-playlists/:id`
- editor-picks.ts: `/editor-picks`

**Why:** the frontend's login-gate (redirecting logged-out users to `/login`) is a client-side-only restriction. It does nothing to stop a script/scraper calling the API endpoints directly — `optionalAuth` (or no auth) endpoints returned full catalog data to anyone regardless of the frontend gate. The user explicitly asked to lock this down until they build a proper public API later.

**How to apply:** if new catalog/content-listing endpoints are added, default to `requireAuth` unless there's an explicit product reason for public access (e.g. a future public API). If the user asks to reopen these to the public, revert the specific routes back to `optionalAuth` rather than removing auth entirely, so logged-in personalization (follow status, favorites, etc.) still works. Non-GET action-tracking endpoints like `/songs/:id/play` and `/videos/:id/view` still intentionally use `optionalAuth` (not touched by this lockdown) since they're not full content dumps.
