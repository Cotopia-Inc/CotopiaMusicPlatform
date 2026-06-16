---
name: Cotopia role badges on every displayed name
description: System-wide convention — every rendered user name must carry a real role badge sourced from the backend
---

## The rule

Anywhere a user's name/username/displayName is rendered (players, chats, DMs, conversation lists, search results, admin/legal/copyright/DMCA panels, broadcast history, editor-picks pickers, profile headers), it MUST sit next to `<RoleBadges role={...} isVerified={...} />`. The `role` value must come from a REAL role field returned by the backend — not hardcoded.

**Why:** This was a repeat problem across multiple sessions — fixes kept being done page-by-page, leaving gaps the user kept rediscovering. Treat it as a global invariant, not a per-page task.

## How to apply

- Backend: any query that returns a user-facing name must also select that user's `role`. For a SECOND user reference in the same row (e.g. issuedBy, reviewedBy), add an aliased self-join: `.leftJoin(sql\`users rv\`, sql\`${table.reviewedBy} = rv.id\`)` and select `sql<string|null>\`rv.role\``.
- `RoleBadges` returns null for `listener`/null roles by design — so badging a listener safely shows nothing.
- EXTERNAL free-text entities are NOT users and must stay unbadged: DMCA claimant name/email (legal.ts), CEO-message authorName (company hub).
- Codegen-backed types (Broadcast, ChatMessage, DirectMessage, ConversationUser) need the `role`/`senderRole` field added to the OpenAPI schema, then `pnpm --filter @workspace/api-spec run codegen`. Direct-fetch admin/legal endpoints only need the backend field added (no spec change).
- Verification sweep: any rendered displayName/username token should be adjacent to a `RoleBadges`. Two participants in one row (admin-messages `↔` list) each need their own badge.
