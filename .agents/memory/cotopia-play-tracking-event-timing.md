---
name: Cotopia play/view count must gate on "playing", not "play" or click
description: Play/view count increments and analytics events must only fire on the native media "playing" event (data genuinely rendering), never on click handlers or the "play" event alone.
---

Both the global `Player` (`artifacts/cotopia/src/lib/player.tsx` + `artifacts/cotopia/src/components/player.tsx`) and the video-detail page's inline `<video>` (`artifacts/cotopia/src/pages/video-detail.tsx`) previously recorded play/view counts too early, causing counts to increment (and playback timers to appear stuck at 0:00) even when nothing was actually playing.

Two distinct anti-patterns caused this, found in the same investigation:

1. **Recording on click, not on playback.** `video-detail.tsx`'s `handlePlayVideo` (fired directly from the Play button's `onClick`) called `recordVideoView.mutate(...)` immediately, before the `<video>` element had even attempted to load the source.
2. **Recording on the native `"play"` event.** The global player's audio/video elements dispatched a `cotopia:playback_started` custom event from the `"play"` listener. Per the HTML media spec, `"play"` fires as soon as playback is *requested* (immediately after calling `.play()` or via the `autoPlay` attribute) — it fires even if the source is broken and playback subsequently errors out and never renders a single frame. `"playing"` is the correct signal: it only fires once the element has genuinely resumed/started rendering media after buffering.

**Why:** discovered via a user report that clicking a song incremented its play count without playback happening, and the timer never advanced. Root cause was the eager click/`"play"`-based tracking. Confirmed with a broken video source in e2e testing: after the fix, a source that fails to load (`"no supported source was found"`) correctly leaves the view count unchanged and the timer at 0:00.

**How to apply:** any play/view-count-incrementing mutation (or equivalent analytics `trackEvent`) tied to media playback must be gated on the media element's `"playing"` event (`onPlaying` in React, or `addEventListener("playing", ...)`), with a per-track/per-video dedupe ref so repeated `"playing"` events from rebuffering during one session don't double-count. Never fire it from a click handler or from `"play"` alone. `"play"`/`onPlay` remains fine for UI-only state (e.g. toggling a playing/paused icon or presence heartbeats) — just not for count-incrementing side effects.
