---
name: Cotopia submission approval workflow
description: Role-based multi-stage submission review state machine and where its logic lives
---

# Submission approval workflow (role-based)

The `submissions.status` column is plain `text` (no DB enum), so adding/changing
status values needs NO migration — only update the OpenAPI enums + code. Default is
`pending_moderator_review`.

**Stages:** draft → pending_payment → paid → pending_moderator_review →
(moderator_approved/) pending_admin_final_review → published, with side branches
moderator_rejected, escalated_to_admin, rejected, admin_approved (scheduled).

**Single review endpoint:** `POST /submissions/:id/review` body `{ action, notes? }`.
Role gating is by ACTION → allowed roles (rolesForAction): moderator actions =
moderator+admins; admin actions = admins only; editor actions = editor+admins.
admins/master_admins can run moderator+editor actions too (override).

**Why one endpoint:** keeps the state machine + audit logging in one place. The legacy
`PATCH /submissions/:id` (approved/rejected/published) is kept but locked to
admin/master_admin ONLY — moderators/editors must go through the review endpoint, else
they could publish via PATCH and bypass the role gate. Don't widen reviewerRoles there.

**Transition guards** in the review handler: moderator state-changing actions
(moderator_approve/reject/escalate) require status `pending_moderator_review`; admin
state-changing actions (admin_publish/reject/return_to_moderator) reject TERMINAL
statuses (published/rejected/moderator_rejected) with 409. flag_legal/notes allowed anytime.

**Key couplings:**
- `publishContent()` (publisher.ts) already sets content + submission status to
  "published"; the review handler also sets status:"published" to stay consistent —
  harmless redundant write, keep them in lockstep if you change one.
- admin_publish honors a future `releaseDate` parsed from `submitterNotes` JSON →
  sets submission `admin_approved` + content `approved` (scheduled), not published.
- Every action writes an `adminAuditLogsTable` row (targetType "submission") and most
  notify the submitter via `notificationsTable`.

**Frontend:** `admin-submissions.tsx` is shared by BOTH `/admin/submissions` and
`/moderator/submissions` routes — it is role-aware (mode = moderator/editor/admin via
useAuth). Uses generated `useReviewSubmission` hook. Moderator dashboard counts query
`status: "pending_moderator_review"`.

**How to apply:** when adding a new review action, add it to the OpenAPI
SubmissionReviewInput enum, run codegen, add a case in the switch + a rolesForAction
group, and a label in the frontend ACTION_TOAST map.
