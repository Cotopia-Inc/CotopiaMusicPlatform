---
name: Cotopia completion-rate inflation
description: Why song/video "completion rate" analytics could exceed 100%, and the two-layer fix (client dedup + server clamp)
---

Completion rate (completions / plays or views) could show >100% (e.g. 140%, 109%) across every surface that computes it: admin.ts global + per-item, safety.ts (beta analytics) per-song, admin-beta-analytics.tsx `pct()` helper.

**Why:** plays/views are deduped per session (one increment per genuine playback start, gated on the native "playing" event and a `lastTrackedId`-style ref). Completions were NOT deduped — every "ended" event unconditionally logged a `song_complete`/`video_complete` row. Repeat-one mode loops the same track via `media.currentTime = 0; media.play()` without changing `track.id`, so each loop re-fires "ended" (new completion) while the play-count guard blocks re-incrementing the play. Manually replaying a finished track without navigating away had the same asymmetry. Net effect: completions could grow unboundedly relative to the one-time play/view count.

**How to apply:** Any future analytics event follows the same pattern class — a "start" event that's session-deduped and an "end"/"complete" event that isn't. Two-layer fix, both needed:
1. Add the same one-per-session dedup ref for the completion dispatch as already exists for the play dispatch (reset together when the tracked id changes) — in both the global player (`components/player.tsx`) and any page with its own inline `<video>`/`<audio>` (e.g. `video-detail.tsx`), per the inline-media-tracking memory.
2. Defensively clamp on the server too (`Math.min(completions, plays)`, `Math.min(100, rate)`) — protects against historical inflated rows and any other yet-undiscovered duplicate-event path, since raw `analytics_events` rows have no unique constraint per session.

Presence-based "N listening/watching" counts (in-memory heartbeat, 30s TTL) can also show a stray non-zero count moments after a real session ended — that's expected self-healing staleness, not a bug; confirm by re-querying after the TTL window before treating it as broken.
