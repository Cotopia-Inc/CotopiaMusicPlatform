---
name: Cotopia playlist/editorial-playlist song release-date leak
description: Song-only surfaces (personal playlists, editorial playlists) exposed streamUrl for unreleased songs without checking status/releaseDate, unlike /songs and /songs/:id.
---

`songs.ts`, `videos.ts`, `artists.ts`, `home.ts`, `discover.ts` all gate public content on `status === "published"` AND `releaseDate` having arrived (the `releasedSong`/`releasedVideo` pattern: `or(isNull(releaseDate), lte(releaseDate, CURRENT_DATE))`). Two song-only endpoints were missed because they don't have a video equivalent to have already been fixed alongside: `playlists.ts` (`GET /playlists/:id`) and `editorial-playlists.ts` (`GET /editorial-playlists/:id`) returned playlist items straight from a join with `songsTable`, including `streamUrl`, with no release/status filter at all — so an unreleased/future-dated song added to a playlist (personal or editor-curated) was fully playable before its scheduled release date.

**Why:** because these are song-only structures (there's no video-playlist equivalent), this bug only affected songs, never videos — matching a user report of "release date works for videos but not songs."

**How to apply:** any new or existing endpoint that selects raw song/video rows (especially ones exposing `streamUrl`/`videoUrl`) needs the same `isReleased` gate as the canonical `/songs`, `/songs/:id` routes, with a staff/owner bypass — don't assume a shared gate up in `songs.ts` protects every downstream join. Fixed via a local `isSongReleased(status, releaseDate)` helper in each file; playlist owner and staff (`admin`/`master_admin`/`editor`/`moderator`) still see unreleased picks in their own playlists, everyone else gets them silently filtered out (not a 404, since it's a list, not a single-item fetch).
