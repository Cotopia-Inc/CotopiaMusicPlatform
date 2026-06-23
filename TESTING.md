# Cotopia Platform Safety & Beta Feedback — Testing Guide

This guide covers manual and automated testing paths for all safety, moderation, and beta feedback features.

## Demo accounts (password: `password123`)

| Email | Role |
|---|---|
| admin@cotopia.com | master_admin |
| editor@cotopia.com | editor |
| mod@cotopia.com | moderator |
| alex@example.com | listener |
| nova@example.com | artist (Nova Sounds) |

---

## 1. Age Requirement (T002)

**Goal:** Confirm users must acknowledge 18+ age requirement at registration.

1. Go to `/register`.
2. Fill in all fields without checking the age checkbox.
3. **Expected:** Form cannot be submitted — checkbox is required.
4. Check the box: "I confirm I am at least 18 years old or the age of legal majority in my jurisdiction."
5. Complete registration.
6. **Expected:** Account created; `agreement_acceptances` table row inserted with `agreementType = 'age'`.

---

## 2. Email Verification Gates (T003)

**Goal:** Chat posting, private messages, and content submissions require a verified email.

**Setup:** Register a fresh account (email will be unverified by default).

### Chat gate
1. Log in with the new account.
2. Open any song or video detail page and try to post a chat message.
3. **Expected:** `403` with `code: email_not_verified`; frontend shows the verify-email banner.

### Messaging gate
1. Try to send a direct message (`POST /api/messages`).
2. **Expected:** Same 403 / banner.

### Submission gate
1. Go to `/submit` and attempt to submit a song.
2. **Expected:** API returns 403; submit page shows the verify-email banner.

### Unlock
1. Go to `/verify-email`, request OTP, enter it.
2. Retry all three actions — **Expected:** all succeed.

**Toggle (admin):** In Admin → Settings, toggle "Require Email Verification" off — all gates pass without verification.

---

## 3. User Blocking (T004)

**Goal:** Blocking prevents follows, DMs, and chat interactions.

1. Log in as `alex@example.com`.
2. Visit another user's profile (e.g., `/users/<id>`).
3. Click **Block** — confirm the button toggles to "Unblock".
4. **Expected:** `POST /api/users/block` returns 200.

### Follow enforcement
5. While blocking is active, try to follow the blocked user's artist page.
6. **Expected:** `403 "Cannot follow this user"`.

### Unblock
7. Click **Unblock** — **Expected:** follow now succeeds.

---

## 4. Private Message Policy (T005)

**Goal:** `messagePolicy` controls who can DM a user.

1. Log in as `nova@example.com`, go to `/profile`, open the **Privacy** tab.
2. Change "Who can message me" to **Followers only**, save.
3. **Expected:** `PATCH /api/auth/me` returns 200; `messagePolicy` column updated.
4. Log in as `alex@example.com` (not following Nova).
5. Try to send Nova a DM.
6. **Expected:** `403` from messaging route.
7. Have Alex follow Nova (artists follow), then retry DM.
8. **Expected:** Message delivered.

Policy options to test: `everyone`, `followers_only`, `verified_only`, `nobody`.

---

## 5. Report System (T006)

**Goal:** Users can report songs, videos, profiles, and chat messages.

1. Log in as `alex@example.com`.
2. Open a song detail page → click the **⋯** / flag menu → **Report**.
3. Select reason (e.g., "Spam"), optionally add details, submit.
4. **Expected:** `POST /api/reports` returns 201.

5. Open a video detail page → flag the video itself and a chat message — both should work.
6. Open a user profile → click **Report** — should work.

### Moderation queue
7. Log in as `mod@cotopia.com`, go to `/admin/reports`.
8. **Expected:** Report appears with status "Pending".
9. Click **Start Review** → status → "Reviewing".
10. Click **Resolve** → reporter receives a notification ("Your report was reviewed").
11. Try **Dismiss** → reporter notified accordingly.

---

## 6. Verification Badges (T007)

**Goal:** Admin can grant artist/label verified status; badge appears on profile and detail pages.

1. Log in as `admin@cotopia.com`, go to `/admin/users`.
2. Find Nova Sounds, grant **Verified (Artist)**.
3. **Expected:** `verificationType = 'artist'`, `isVerified = true` in DB; gold checkmark appears.
4. Visit Nova's artist detail page — **Expected:** gold artist checkmark next to name.
5. Visit a label detail page for a verified label — **Expected:** blue label checkmark.
6. Revoke verification from admin — badge disappears.

---

## 7. Tiered Enforcement (T008)

**Goal:** warning → strike → suspension → ban, with role gating and auto-escalation.

### Moderator: Warning only
1. Log in as `mod@cotopia.com`, go to `/admin/enforcement`.
2. Search for `alex@example.com`, issue a **Warning** with a reason.
3. **Expected:** action created; user receives a "⚠️ Warning" notification.
4. Try to issue a **Strike** as moderator — **Expected:** `403 "You do not have permission"`.

### Admin: Strike + auto-escalation
5. Log in as `admin@cotopia.com`.
6. Issue strikes until the configured threshold (default: 3) is reached.
7. **Expected:** auto-suspension created; user receives "⛔ Account Suspended" notification; `isSuspended = true`.
8. Issue repeated suspensions past the ban-review threshold — **Expected:** master_admin receives "🚩 Ban Review Recommended" notification.

### Permanent ban (master_admin only)
9. Log in as `admin@cotopia.com`, try to ban a user — **Expected:** `403`.
10. Log in as `admin@cotopia.com` (master_admin), issue **Permanent Ban**.
11. **Expected:** `isBanned = true`; user's next API call returns `403 { code: "banned" }`.

### Lift actions
12. Go to Enforcement history, click **Lift** on a suspension.
13. **Expected:** `isSuspended = false`; action status → "lifted".

---

## 8. Feedback Center (T009)

**Goal:** Users can submit beta feedback; admins triage it.

1. Log in as any user, go to `/feedback`.
2. Submit a **Bug report** with title and description.
3. **Expected:** `POST /api/feedback` returns 201; item appears in "My Submissions".
4. Submit a **Feature request** and a **General** feedback.

### Admin triage
5. Log in as `admin@cotopia.com`, go to `/admin/feedback`.
6. **Expected:** All three items visible.
7. Change status to **In Progress**, add admin notes.
8. **Expected:** Status updated; `PATCH /api/admin/feedback/:id` returns 200.
9. User visits `/feedback` — **Expected:** admin notes visible next to their submission.

---

## 9. Beta Analytics (T010)

**Goal:** Admin can view beta program metrics.

1. Log in as `admin@cotopia.com`, go to `/admin/beta-analytics`.
2. **Expected:** Dashboard loads with feedback totals, upload completion stats, community engagement metrics.
3. Interact with the app (submit feedback, play songs, send messages), then refresh.
4. **Expected:** Counts reflect recent activity.

---

## 10. Automated regression tests

```bash
pnpm --filter @workspace/api-server run test
```

Covers: auth, blocks, copyright, DMCA, enforcement, reports, feedback, messages, submissions, admin flows.
