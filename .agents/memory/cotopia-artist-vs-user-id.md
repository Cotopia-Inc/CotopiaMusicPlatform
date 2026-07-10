---
name: Cotopia artist id vs user id
description: /artists/:id uses the artists table PK, which is a different number than the underlying user's id — needed for correct navigation and for any feature keyed on the creator's user account.
---

`artists.id` (used in `/artists/:id` frontend routes and most `/api/artists/:id` calls) is a separate primary key from `users.id`. An artist row has its own `id` plus a `userId` FK pointing to the owning user.

**Why:** Any feature keyed on the user account (creator-support settings, messaging, follows, badges, auth) must use `artist.userId`, not the artist row's own `id`. Confusing the two silently loads the wrong artist/creator (test navigated to `/artists/<userId>` and landed on an unrelated artist with no error) rather than failing loudly.

**How to apply:** When writing test plans, seed data, or one-off scripts involving an artist, always fetch the artist record first (e.g. `GET /api/artists/:id` or a DB join) and read `.userId` before doing anything user-scoped. Don't assume `/artists/<N>` corresponds to the user whose id is `N`.
