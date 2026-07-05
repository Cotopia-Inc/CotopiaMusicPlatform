---
name: Cotopia inline media playback bypasses view/play tracking
description: Pages with their own local <video>/<audio> element (not routed through the global Player) silently skip view/play count increments unless they call the record mutation themselves.
---

The global `Player` component (`artifacts/cotopia/src/components/player.tsx`) is the only place that automatically calls `useRecordSongPlay` / `useRecordVideoView` — it does so in a `useEffect` keyed on `track?.id` whenever the active track changes.

Any page that plays media through its own local `<video>`/`<audio>` element instead of routing playback through the global player (e.g. `video-detail.tsx`'s inline HTML5 `<video>` shown after clicking its own local "Play" button) will NOT trigger that effect, so the view/play counter silently never increments for that flow — even though the media genuinely plays.

**Why:** discovered when a video genuinely watched via the video-detail page's own inline player still showed "0 views" — the page had a separate `handlePlayVideo` that only fired an analytics `trackEvent`, never the count-incrementing mutation.

**How to apply:** whenever adding/reviewing a play/watch UI surface, check whether it goes through `usePlayer()`'s `play`/`playAt` (which the global Player's effect will pick up) or has its own local media element. If it's local, explicitly call `useRecordSongPlay`/`useRecordVideoView` in the local play handler (and invalidate the relevant `getGetSongQueryKey`/`getGetVideoQueryKey` on success so the UI count updates without a full reload). Song detail page already does this correctly by using `usePlayer()`'s `play` — use it as the reference pattern.
