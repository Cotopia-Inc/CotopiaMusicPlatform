---
name: Cotopia AI content tagging system
description: Architecture decisions for the AI/Human content origin tagging feature (Hive Moderation provider)
---

## Key design decisions

**creationMethod flows through req.body directly (not Zod schema)**
- The `CreateBulkSubmissionBody` Zod schema (Orval-generated) does not include `creationMethod` yet.
- Both the backend route and the frontend `@ts-expect-error` bypass: read `creationMethod` from `req.body` separately after Zod parse.
- When the OpenAPI spec is updated, remove the bypass and let Zod validate it properly.

**AI settings use a separate admin endpoint, not app_settings hooks**
- `GET/PATCH /api/admin/ai-settings` is a custom route in `admin.ts` — not part of the Orval-generated `useGetAppSettings`/`useUpdateAppSettings` hooks.
- `admin-settings.tsx` fetches it directly with `localStorage.getItem("cotopia_token")` on mount.

**Hive provider graceful degradation**
- `lib/hive-detection.ts` returns `{ available: false }` when `HIVE_API_KEY` is unset — never fabricates scores.
- HIVE_API_KEY must be set in the Render environment for scans to activate.
- The route guards `enableAiReview` app_setting before triggering scans.

**effectiveDisplayTag priority (computed at write time)**
- `appeal_decision > admin (platformAssignedTag + tagLocked) > creator (creatorSelectedTag) > detection > unclassified`
- Set at insert/update time in the route, not computed dynamically on read.

**req.user! uses userId not id**
- All Express AuthRequest handlers use `req.user!.userId` (the JWT payload field name).
- Using `req.user!.id` causes TS2339 — `JwtPayload` has no `id` property.
- The `logAudit` helper in `ai-review.ts` wraps adminUserId + action for DRY audit logging.

**Sub interface in admin-submissions.tsx must be extended for new DB fields**
- Any new columns added to the submissions enrichment response must be reflected in the local `Sub` interface — the generated Orval types don't cover admin-enriched fields.
- Add `contentId?: number | null` and all AI fields explicitly.

**Badge is always a CSS overlay**
- `ai-origin-badge.tsx` never modifies artwork — it positions absolutely over the parent container.
- Parent must have `position: relative` for the overlay to work correctly.
