# Platform Safety & Beta Feedback — Testing Guide

This guide explains how to manually test the safety and beta-feedback features added in the
**Platform Safety and Beta Feedback Update**. All flows can be exercised through the running app
(frontend at the Cotopia preview, API at `/api`).

## Demo accounts (password: `password123`)

| Email | Role | Use for |
|---|---|---|
| admin@cotopia.com | master_admin | Moderation queue, enforcement, verification, beta analytics, feedback dashboard |
| mod@cotopia.com | moderator | Report review, enforcement (warnings/strikes/suspensions) |
| editor@cotopia.com | editor | Admin-only actions (feedback dashboard, verification, lift enforcement) |
| alex@example.com | listener | Reporting, blocking, feedback submission, PM settings |
| nova@example.com | artist | Email-verification gates, verification badge target |
| deepwave@example.com | label | Verification badge (label) target |

> Tip: open two browsers (or one normal + one incognito) so you can act as a regular user in one
> and as an admin/moderator in the other.

---

## 1. Email verification

Email verification gates content-creating actions (submissions, fan chat, private messages).

**Test the gate (unverified user):**
1. Register a brand-new account, or pick a seeded account whose `emailVerified` is `false`.
2. Try to: submit music/video (`/submit`), post in a song/video fan chat, or send a private message.
3. **Expected:** a "Verify your email" banner appears above the input, and the action is blocked
   server-side with a `403` (`Email verification required`).

**Test the happy path (verified user):**
1. Log in as `admin@cotopia.com` (already verified) or verify an account.
2. Repeat the same actions.
3. **Expected:** no banner; submissions, chat, and messages all succeed.

**API check:**
```bash
# Returns { messagePolicy, emailVerified }
curl -s localhost:80/api/users/me/settings -H "Authorization: Bearer <TOKEN>"
```

---

## 2. Blocking users

Blocking hides a user and prevents messaging **and** following in both directions.

**Test from a profile:**
1. As `alex@example.com`, open another user's profile (e.g. Nova).
2. Click **Block**.
3. **Expected:** the button toggles to "Unblock"; you can no longer message that user, and any
   existing follow relationship is severed.

**Test follow enforcement:**
1. While a user is blocked, attempt to follow them (or have them follow you).
2. **Expected:** the follow is rejected server-side (`403`).

**Test messaging enforcement:**
1. Open `/messages` and try to message a blocked user.
2. **Expected:** sending is blocked.

**API check:**
```bash
# List the IDs you have blocked
curl -s localhost:80/api/users/blocks -H "Authorization: Bearer <TOKEN>"
```

---

## 3. Reporting content

Users can report songs, videos, chat messages, private messages, and other users. Reports land in
the moderation queue.

**Submit a report (regular user):**
1. As `alex@example.com`, open a song and use the **⋯ menu → Report**, or click the flag icon on a
   fan-chat message, a private message, or another user's profile.
2. Choose a reason, add optional details, and submit.
3. **Expected:** a confirmation toast; the report is created with status `pending`.

**Review a report (moderator/admin):**
1. Log in as `mod@cotopia.com` and open **Moderation → Reports** (`/admin/reports`).
2. **Expected:** the new report appears. You can mark it `reviewed`/`resolved`/`dismissed` and add
   admin notes.

**API check:**
```bash
# Create a report
curl -s -X POST localhost:80/api/reports \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"targetType":"song","targetId":1,"reason":"spam","details":"..."}'

# List the moderation queue (moderator/admin token)
curl -s localhost:80/api/admin/reports -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## 4. Verification badges

Admins can grant a verification badge of type `artist` (yellow) or `label` (sky) to a user. The
badge shows next to their name across the app.

**Grant / revoke (admin):**
1. Log in as `admin@cotopia.com`.
2. Grant verification to a user (e.g. via the members admin or the verification endpoint).
3. **Expected:** an artist/label badge appears on that user's profile, in chat, and in messages.
4. Revoke it and confirm the badge disappears.

**API check:**
```bash
# Grant: { userId, verificationType: "artist" | "label" | null }
curl -s -X POST localhost:80/api/admin/verification \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  -d '{"userId":5,"verificationType":"artist"}'
```

---

## 5. Warning / enforcement system

Tiered moderation: **warning → strike → suspension → ban**. Actions notify the target user and are
gated by role (moderators can warn/strike/suspend; lifting requires admin).

**Issue an action (moderator/admin):**
1. Log in as `mod@cotopia.com` and open **Moderation → Members** (`/admin/members`).
2. Issue a warning, strike, suspension, or ban against a user with a reason.
3. **Expected:** the action is recorded; the target receives a notification. A suspension sets
   `suspendedUntil`; a ban sets `isBanned`.

**Verify enforcement effect:**
1. Log in as the suspended/banned user.
2. **Expected:** suspended users cannot perform gated actions until the suspension expires; banned
   users are blocked from the platform's content actions.

**Lift an action (admin only):**
1. As `admin@cotopia.com`, lift an active enforcement action.
2. **Expected:** the user regains access; moderators (non-admin) cannot lift.

**API check:**
```bash
# Issue: { userId, type: "warning"|"strike"|"suspension"|"ban", reason, ... }
curl -s -X POST localhost:80/api/admin/enforcement \
  -H "Authorization: Bearer <MOD_TOKEN>" -H "Content-Type: application/json" \
  -d '{"userId":5,"type":"warning","reason":"..."}'

# List enforcement history
curl -s localhost:80/api/admin/enforcement -H "Authorization: Bearer <MOD_TOKEN>"
```

---

## 6. Feedback system

Beta users submit categorized feedback (`bug`, `feature`, `general`); admins triage it and view
beta analytics.

**Submit feedback (user):**
1. As any logged-in user, open **Beta Feedback** (`/feedback`).
2. Choose a type, fill in a title + description (optional screenshot URL), and submit.
3. **Expected:** confirmation toast; the entry shows in your own list (`/feedback/mine`).

**Triage feedback (admin):**
1. Log in as `admin@cotopia.com` and open **Feedback** (`/admin/feedback`).
2. **Expected:** all feedback is listed and filterable by type; you can change status and add notes.

**Beta analytics (admin):**
1. Open **Beta Analytics** (`/admin/beta-analytics`).
2. **Expected:** aggregate metrics — feedback counts by type, user retention, upload completion,
   and chat participation.

**API check:**
```bash
# Submit feedback: { type: "bug"|"feature"|"general", title, description, screenshotUrl? }
curl -s -X POST localhost:80/api/feedback \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"type":"bug","title":"...","description":"..."}'

# Admin dashboard + analytics
curl -s localhost:80/api/admin/feedback -H "Authorization: Bearer <ADMIN_TOKEN>"
curl -s localhost:80/api/admin/beta-analytics -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## Regression checklist

- `pnpm run typecheck` — passes across all packages.
- Existing flows (auth, browsing, streaming, playlists, submissions) still work.
- Age confirmation checkbox is required on registration and records an `age_confirmation`
  agreement acceptance.
