# Cotopia Platform — Testing Guide

A hands-on guide for manually verifying Cotopia's core features during the beta period.  
Demo accounts all use password **`password123`**.

---

## 1. Accounts & Authentication

| What to verify | Steps |
|---|---|
| Registration | Go to `/register`, fill in username/email/password, check both consent boxes, submit. Confirm redirect to home. |
| Age gate | Uncheck the age confirmation box — form should block submission with an error. |
| ToS gate | Uncheck the ToS box — form should block submission. |
| Login / Logout | Sign in as `alex@example.com`, confirm home feed loads; click avatar → Logout. |
| Email verification | Enable "Require Email Verification" in Admin → Settings. Log in as `alex@example.com` (unverified) and attempt to post a chat message or DM — should see a verification banner. |

---

## 2. Content Discovery & Streaming

| What to verify | Steps |
|---|---|
| Home feed | Log in and confirm featured songs, videos, trending, new releases appear. |
| Song playback | Click any song — mini-player should appear and play audio. |
| Video streaming | Navigate to any video page — video should stream; chat panel appears on right. |
| Discover | Go to `/discover`, apply genre and mood filters — results should narrow. |
| Search | Use the search bar to find a song or artist by name. |
| Completion tracking | Play a song/video to the end — check Admin → Beta Analytics for updated completion rates. |

---

## 3. Artist & Label Features

| What to verify | Steps |
|---|---|
| Artist profile | Navigate to `/artists`, click any artist — profile page shows bio, songs, videos. |
| Follow/Unfollow | Log in as `alex@example.com`, follow Nova Sounds — count updates; unfollow — count decreases. |
| Artist submission | Log in as `nova@example.com`, go to `/submit`, upload a song with metadata and pay (mock) — submission shows "pending". |
| Label submission | Log in as `deepwave@example.com`, submit an artist or album — submission shows "pending". |

---

## 4. Playlists & Library

| What to verify | Steps |
|---|---|
| Create playlist | Log in, go to Library → Playlists, create a new playlist. |
| Add to playlist | From any song page, click ⊕ and add to the new playlist. |
| Reorder / Remove | Open the playlist, drag to reorder (or use the remove button). |
| Play history | Play a few songs — check Library → History; entries should appear. |
| Favorites | Star a song — it appears in Library → Favorites; star again to un-favorite. |

---

## 5. Social & Messaging

| What to verify | Steps |
|---|---|
| Chat | Log in as `alex@example.com`, open any video — type and send a message. Message appears immediately. |
| Edit chat message | Hover own message → pencil icon → edit and save. |
| Delete chat message | Hover own message → trash icon → message removed. |
| Block from chat | Hover another user's chat message → shield icon to block. Confirm blocked-users list updated. |
| Report chat message | Hover another user's message → flag icon → submit a report. |
| Direct messages | Open `/messages`, start a conversation with another user. |
| Message policy | Log in as `alex@example.com`, go to Profile → Settings, change "Who can message me" to **Nobody** — another user's DM attempt should fail. |
| Notifications | Trigger an action (follow, submission approval) — check `/notifications`. Hover a notification to delete it. "Clear all" removes all. |

---

## 6. Blocking & Reports

| What to verify | Steps |
|---|---|
| Block user | Visit any user's profile (`/users/:id`) — click **Block**. They can no longer DM you. |
| Unblock user | Return to the same profile and click **Unblock**. |
| Report content | From any song, video, or profile page, click the **Report** flag and submit a reason. |
| Admin report queue | Log in as `admin@cotopia.com`, go to Admin → Reports — new report should be listed as "Pending". Change status to "Reviewing", then "Resolved". |

---

## 7. Admin CMS & Moderation

| What to verify | Steps |
|---|---|
| Approve submission | Log in as `admin@cotopia.com`, go to Admin → Submissions, approve a pending submission — content becomes published. |
| Reject submission | Reject a submission with a reason — artist receives a notification. |
| Verification badge | Admin → Roles (or Admin → Enforcement), find a user, grant **Verified (Artist)** — blue checkmark appears on their profile. |
| Enforcement — Warning | Admin → Enforcement → Issue Action → select Warning, pick a user, enter reason. User receives notification. |
| Enforcement — Strike | Issue a Strike; user is notified. If auto-escalation is on and threshold met, suspension is triggered automatically. |
| Enforcement — Suspension | Issue a Suspension with a duration; account is suspended, user notified. |
| Enforcement — Lift | On an active action, click **Lift** — status changes to "Lifted"; suspension is cleared. |
| Broadcast | Admin → Broadcast — send an announcement; all users receive a notification. |
| Audit log | Admin → Audit Logs — every admin action should be logged. |

---

## 8. Feedback Center

| What to verify | Steps |
|---|---|
| Submit feedback | Log in as any user, go to `/feedback`, submit a Bug Report and a Feature Request. |
| View own feedback | Below the form, past submissions show with status and any admin response. |
| Admin triage | Log in as `admin@cotopia.com`, go to Admin → Beta Feedback — feedback items listed. Change status to "In Progress" and add a note. |
| Admin beta analytics | Admin → Beta Analytics — confirm feedback counts, retention, and upload completion metrics are shown. |

---

## 9. Regression Tests (automated)

Run the full API regression suite:

```bash
pnpm --filter @workspace/api-server run test
```

All tests should pass. The suite covers:
- Auth endpoints (register, login, verify-email, change-email)
- Role-gated routes (403/401 enforcement)
- Safety endpoints (reports, enforcement, feedback)
- Message policy enforcement
- Block enforcement on DMs

---

## 10. Checklist — Before Beta Launch

- [ ] All 39+ automated tests pass  
- [ ] Email verification flows tested end-to-end  
- [ ] At least one submission approved and one rejected  
- [ ] Report → moderation → enforcement cycle completed  
- [ ] Auto-escalation config verified in Admin → Settings  
- [ ] Broadcast message sent and received by demo accounts  
- [ ] Beta analytics show real data (not zeroes)  
- [ ] Audit log has entries for all admin actions taken above  
