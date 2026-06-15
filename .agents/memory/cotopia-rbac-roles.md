---
name: Cotopia RBAC role separation
description: Which roles belong in which route guards — editor is NOT a moderator, they have separate access paths
---

## The rule

`MOD_ROLES = ["moderator", "admin", "master_admin"]` — editor is explicitly excluded.
`EDITOR_ROLES = ["editor", "admin", "master_admin"]` — editor gets editorial tools only.

**Why:** Editors and moderators have distinct toolsets. Editors review for quality; moderators enforce policy. Mixing them caused two sessions of back-and-forth confusion. The distinction is intentional and should not be "simplified" by adding editor to MOD_ROLES.

## How to apply

- `/moderator/*` routes: MOD_ROLES (no editor)
- `/editor/*` + `/admin/discover`, editorial playlists: EDITOR_ROLES
- Copyright concerns, DMCA, strikes: admin/master_admin only (ADMIN_ROLES)
- Submission listing GET: ADMIN_ROLES + moderator + editor (editor dashboard shows submissions for quality review)
- Comment deletion: ADMIN_ROLES + moderator only (NOT editor)
- Submission review PATCH: ADMIN_ROLES + moderator + editor (editor can approve for quality)

## Copyright concerns escalation flow

- Moderators use `/moderator/copyright-concerns` to **escalate** (not issue) concerns
- Admins review at `/admin/copyright-concerns` and decide: dismiss or issue strike
- Actual copyright strikes (copyright_strikes table) are issued separately via `/admin/strikes`
- The concern PATCH with `status: "strike_issued"` is a recommendation only — admin then creates the formal strike via the existing strikes endpoint
