---
name: Cotopia admin vs user-facing endpoint conventions
description: Which Cotopia frontend calls go through Orval-generated hooks vs raw fetch(), and why
---

# Endpoint wiring conventions

Two conventions coexist in the Cotopia frontend. Match the one that fits the surface you touch.

## User-facing endpoints → contract-first (OpenAPI + Orval hooks)
User-facing endpoints (including safety/settings: reports, feedback, user message settings) must be declared in `lib/api-spec/openapi.yaml` and consumed via generated React Query hooks, not hand-rolled fetch.
**Why:** code review rejects hand-rolled fetch for user-facing endpoints; they must be typed (hooks + Zod).
**How to apply:** add the path+schemas to openapi.yaml, run `pnpm --filter @workspace/api-spec run codegen`, then use the generated hook. Hook quirks (mutation shape, conditional-query queryKey) are in cotopia-hook-quirks.md.

## Admin / moderation endpoints → direct fetch()
Admin-only routes (DMCA, strikes, audit logs, enforcement actions, role management, blocks) use raw `fetch()` with a bearer header — even when the endpoint exists in the spec. This is the pre-existing convention.
**Why:** established convention; admin pages were built this way and approved plans kept it.
**How to apply:** for admin/moderation UI, follow the existing direct-fetch pattern. If a reviewer flags only admin endpoints for not being contract-first, that is accepted — document it rather than migrating.

## Misc
- The `comment` report target exists in the schema but has no end-user render surface (comments are moderation-only); user-visible conversational content is Fan Chat (chat_message) and DMs (private_message), both reportable.
