# Everyday Radio — Beta Testing Guide

**Base URL:** https://cotopiamusicplatform.onrender.com  
**Local dev:** http://localhost (via Replit preview)

## Demo Accounts (password: `password123`)

| Email | Role | Use for |
|---|---|---|
| admin@cotopia.com | master_admin | Full admin access |
| editor@cotopia.com | editor | Content upload, picks |
| mod@cotopia.com | moderator | Reports, enforcement |
| alex@example.com | listener | Listener experience |
| nova@example.com | artist | Artist submissions |
| midnight@example.com | artist | Artist submissions |
| deepwave@example.com | label | Label management |

---

## Test Flows

### 1. Registration & Email Verification
1. Go to `/register` → create a new account (any role)
2. After registration, you should land on the email verification page
3. *(Requires real `RESEND_API_KEY` in Render env — see deployment docs)*
4. Admin can bypass: use an existing seeded account (all pre-verified)

**What to check:**
- Age + ToS checkboxes are required before form submits
- Users without verified email cannot: post chat, send messages, or submit content
- Verified email banner appears on blocked features

---

### 2. Content Upload — Admin Direct Publish
*Log in as `admin@cotopia.com`*

1. Go to **Admin → Upload Songs** (`/admin/upload-song`)
2. **Single tab:** Select artist, fill title, click the audio upload zone → file uploads automatically → fill genre → Submit
3. **Bulk tab:** Select multiple MP3 files → each row auto-uploads with a progress bar → fill shared metadata → Publish
4. Go to **Admin → Upload Videos** (`/admin/upload-video`) and repeat
5. Check uploaded content appears on `/songs` and `/videos`

**What to check:**
- Files begin uploading as soon as selected (no separate "Upload" button click needed)
- Progress bar shows 10% → 30% → 100%
- ✓ checkmark appears when done
- "Retry" button (red) appears if upload fails — click to retry
- Published songs/videos appear immediately on public pages

---

### 3. Artist Submission Flow (with Mock Payment)
*Log in as `nova@example.com`*

1. Go to `/submit`
2. Select the **Songs** tab → click the drop zone → select 1–3 MP3 files
3. Files auto-upload with a progress bar — wait for ✓ on each
4. Fill in Genre (required), mood, optional cover art
5. Click **Continue** → choose a plan → proceed to payment
6. Payment is **mocked** (PayPal) — click through to complete
7. Submission goes to admin review queue

*Log back in as `admin@cotopia.com`*

8. Go to **Admin → Submissions** → approve or reject the submission
9. Approved content becomes immediately visible on the platform

---

### 4. Playback & Favorites
*Log in as `alex@example.com`*

1. Browse home page → click a song → it plays in the bottom player
2. Click the ♥ heart to favorite it → appears in **Library**
3. Add to playlist from the **⋯ menu** on any song
4. Rate a song (1–5 stars) on its detail page
5. Navigate to `/library` to see history, favorites, playlists

---

### 5. Follow Artists & Social
1. Go to any artist's page (e.g., `/artists/1`)
2. Click **Follow** → button changes to **Following**
3. Go to `/library` → **Following** tab to confirm
4. Block a user: go to their profile → click **Block** → they can no longer follow you or message you

---

### 6. Chat & Direct Messages
*Chat requires email verification*

1. Open any song or video detail page → scroll to comments/chat section
2. Type a message and send
3. Click a user's name → go to their profile → click **Message**
4. DM conversation opens at `/messages`

**Moderation:**
- Any chat message has a **⚑ flag** button → opens report modal
- Users can report other user profiles

---

### 7. Reporting Content
Report buttons appear for logged-in users on:

- **Songs** — actions row on song detail page (⚑ icon)
- **Videos** — actions area on video detail page
- **Profiles** — user profile page → Report button
- **Chat messages** — flag icon on each message
- **DMs** — flag icon on each message

After reporting:  
*Log in as `mod@cotopia.com`* → **Admin → Reports** (`/admin/reports`)  
→ Review pending reports → mark as resolved or dismissed

---

### 8. Feedback Center
*Log in as any account*

1. Go to `/feedback`
2. Submit a **Bug**, **Feature Request**, or **General** feedback
3. Check **My Submissions** tab to see submitted items

*Log in as `admin@cotopia.com`*

4. Go to **Admin → Feedback** (`/admin/feedback`)
5. Update status (open → in_progress → resolved)

---

### 9. Tiered Enforcement
*Log in as `mod@cotopia.com`*

1. Go to **Admin → Enforcement** (`/admin/enforcement`)
2. Issue a **Warning**, **Strike**, **Suspension**, or **Ban** against a user
3. Suspensions set a time limit; bans are permanent
4. Lift an active action with the "Lift" button (admin only)

**Effects:**
- Suspended/banned users get a 403 on protected routes
- Users receive an in-app notification when an action is issued

---

### 10. Verification Badges
*Log in as `admin@cotopia.com`*

1. Go to **Admin → Enforcement** → **Verification** tab
2. Grant `artist` or `label` verification to any user
3. Visit their profile — a ✓ badge appears next to their name

---

### 11. PM Settings
*Log in as any account*

1. Go to `/profile` → **Settings** tab
2. Change **Message Policy**: Everyone / Followers Only / Verified Only / Nobody
3. Try DMing that user from another account — policy should block or allow accordingly

---

### 12. Beta Analytics
*Log in as `admin@cotopia.com`*

1. Go to **Admin → Beta Analytics** (`/admin/beta-analytics`)
2. View platform-wide metrics: signups, plays, follows, content counts

---

## Known Limitations (Beta)

- **Email OTP** requires a real `RESEND_API_KEY` in the Render env vars — set `FROM_EMAIL=Cotopia <onboarding@resend.dev>` for testing without domain verification
- **Payments** are mocked — no real PayPal charges occur
- **Object storage** uses Replit-provided GCS — file uploads work in dev but require the Replit sidecar on the server; for production hosting on Render, a separate storage solution should be configured

---

## Running Tests

```bash
# API regression tests (requires DATABASE_URL)
pnpm --filter @workspace/api-server run test

# Full typecheck
pnpm run typecheck

# DB schema push (dev only)
pnpm --filter @workspace/db run push
```
