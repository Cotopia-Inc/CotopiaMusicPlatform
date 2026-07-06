---
name: Cotopia inline media playback bypasses view/play tracking
description: Pages with their own local <video>/<audio> element (not routed through the global Player) silently skip view/play count increments unless they call the record mutation themselves.
---

The global `Player` component (`artifacts/cotopia/src/components/player.tsx`) is the only place that automatically calls `useRecordSongPlay` / `useRecordVideoView` — it does so in a `useEffect` keyed on `track?.id` whenever the active track changes.

Any page that plays media through its own local `<video>`/`<audio>` element instead of routing playback through the global player (e.g. `video-detail.tsx`'s inline HTML5 `<video>` shown after clicking its own local "Play" button) will NOT trigger that effect, so the view/play counter silently never increments for that flow — even though the media genuinely plays.

**Why:** discovered when a video genuinely watched via the video-detail page's own inline player still showed "0 views" — the page had a separate `handlePlayVideo` that only fired an analytics `trackEvent`, never the count-incrementing mutation.

**How to apply:** whenever adding/reviewing a play/watch UI surface, check whether it goes through `usePlayer()`'s `play`/`playAt` (which the global Player's effect will pick up) or has its own local media element. If it's local, explicitly call `useRecordSongPlay`/`useRecordVideoView` in the local play handler (and invalidate the relevant `getGetSongQueryKey`/`getGetVideoQueryKey` on success so the UI count updates without a full reload).

**Correction (Jul 2026):** the global Player's `recordSongPlay.mutate`/`recordVideoView.mutate` calls themselves did NOT invalidate the song/video query cache — only `video-detail.tsx`'s separate inline `<video>` tracker did (via its own `onSuccess`). Since songs have no inline detail-page player and rely solely on the global Player, this meant a song's displayed play count never visually updated after playback, even though the DB value incremented correctly. Fixed by adding `onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(...) })` to the global Player's song branch only (`recordVideoView` branch left untouched). Also see [song release-date leaks via playlists](cotopia-playlist-releasedate-leak.md) for a related song-only gap found in the same investigation.
