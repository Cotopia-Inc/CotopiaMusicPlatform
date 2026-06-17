---
name: Cotopia enforcement / system-generated action attribution
description: How to attribute automated enforcement actions, and the not-null adminUserId constraint on audit logs
---

## System vs human enforcement attribution

- `enforcement_actions` distinguishes automated actions via `issuedByUserId = null` **and** `isAutomated = true`. Use both, not just one — `issuedByUserId` alone is ambiguous (could mean the issuer was deleted via `onDelete: set null`).
- Auto-escalation: N active strikes → auto temporary suspension; repeated total suspensions → "ban review" flag (audit log + master_admin notifications). It never auto-bans — bans stay master_admin-only and manual. Thresholds live in `app_settings` (autoEscalationEnabled, strikesUntilSuspension, autoSuspensionDays, suspensionsUntilBanReview).

## Gotcha: admin_audit_logs.adminUserId is NOT nullable

**Why:** `admin_audit_logs.adminUserId` is `.notNull()` with `onDelete: cascade`. You cannot log a "system" action with a null actor.

**How to apply:** For automated/system actions, attribute the audit log to the human who *triggered* the cascade (e.g. the admin whose strike tipped the threshold), while still marking `metadata.automated = true` and the enforcement row `isAutomated = true`. `analytics_events.userId` IS nullable, so null is fine there.
