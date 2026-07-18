import { Router, type Response } from "express";
import { and, gte, lte, desc, eq } from "drizzle-orm";
import {
  db,
  analyticsEventsTable,
  adminAuditLogsTable,
  paymentsTable,
  submissionsTable,
  supportTransactionsTable,
  historyTable,
  usersTable,
  reportsTable,
  enforcementActionsTable,
  dmcaClaimsTable,
  copyrightStrikesTable,
  followsTable,
  agreementAcceptancesTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();
const ADMIN_ROLES = ["admin", "master_admin"] as const;

// ── CSV helpers ───────────────────────────────────────────────────────────

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(","), ...rows.map(r => r.map(escapeCell).join(","))].join("\r\n");
}

function sendCsv(res: Response, dataset: string, headers: string[], rows: unknown[][]): void {
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="cotopia-${dataset}-${date}.csv"`);
  res.send(toCsv(headers, rows));
}

function dateRange(query: Record<string, unknown>): { from: Date | null; to: Date | null } {
  const parseDate = (v: unknown, endOfDay = false): Date | null => {
    if (!v) return null;
    const d = new Date(endOfDay ? `${String(v)}T23:59:59.999Z` : String(v));
    return isNaN(d.getTime()) ? null : d;
  };
  return { from: parseDate(query.from), to: parseDate(query.to, true) };
}

function dateWhere<T extends { createdAt: unknown }>(
  table: T,
  from: Date | null,
  to: Date | null,
) {
  const conditions = [];
  if (from) conditions.push(gte(table.createdAt as Parameters<typeof gte>[0], from));
  if (to)   conditions.push(lte(table.createdAt as Parameters<typeof lte>[0], to));
  return conditions.length ? and(...conditions) : undefined;
}

// ── Analytics Events ──────────────────────────────────────────────────────

router.get("/admin/export/analytics", requireAuth, requireRole(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const { from, to } = dateRange(req.query as Record<string, unknown>);
  const rows = await db
    .select()
    .from(analyticsEventsTable)
    .where(dateWhere(analyticsEventsTable, from, to))
    .orderBy(desc(analyticsEventsTable.createdAt));

  sendCsv(res, "analytics", ["id", "event_type", "event_name", "user_id", "content_type", "content_id", "metadata", "created_at"],
    rows.map(r => [r.id, r.eventType, r.eventName, r.userId, r.contentType, r.contentId, r.metadata, r.createdAt]));
});

// ── Admin Audit Logs ──────────────────────────────────────────────────────

router.get("/admin/export/audit-logs", requireAuth, requireRole(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const { from, to } = dateRange(req.query as Record<string, unknown>);
  const adminUser = usersTable;
  const rows = await db
    .select({
      id: adminAuditLogsTable.id,
      adminUserId: adminAuditLogsTable.adminUserId,
      adminUsername: adminUser.username,
      adminRole: adminUser.role,
      action: adminAuditLogsTable.action,
      targetType: adminAuditLogsTable.targetType,
      targetId: adminAuditLogsTable.targetId,
      description: adminAuditLogsTable.description,
      metadata: adminAuditLogsTable.metadata,
      createdAt: adminAuditLogsTable.createdAt,
    })
    .from(adminAuditLogsTable)
    .leftJoin(adminUser, eq(adminAuditLogsTable.adminUserId, adminUser.id))
    .where(dateWhere(adminAuditLogsTable, from, to))
    .orderBy(desc(adminAuditLogsTable.createdAt));

  sendCsv(res, "audit-logs",
    ["id", "admin_user_id", "admin_username", "admin_role", "action", "target_type", "target_id", "description", "metadata", "created_at"],
    rows.map(r => [r.id, r.adminUserId, r.adminUsername, r.adminRole, r.action, r.targetType, r.targetId, r.description, JSON.stringify(r.metadata), r.createdAt]));
});

// ── Payments ──────────────────────────────────────────────────────────────

router.get("/admin/export/payments", requireAuth, requireRole(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const { from, to } = dateRange(req.query as Record<string, unknown>);
  const creator = usersTable;
  const rows = await db
    .select({
      id: paymentsTable.id,
      userId: paymentsTable.userId,
      userEmail: creator.email,
      username: creator.username,
      submissionId: paymentsTable.submissionId,
      provider: paymentsTable.provider,
      paymentMode: paymentsTable.paymentMode,
      isDemo: paymentsTable.isDemo,
      amount: paymentsTable.amount,
      currency: paymentsTable.currency,
      status: paymentsTable.status,
      paypalOrderId: paymentsTable.paypalOrderId,
      externalTransactionId: paymentsTable.externalTransactionId,
      demoConfirmationNumber: paymentsTable.demoConfirmationNumber,
      createdAt: paymentsTable.createdAt,
      updatedAt: paymentsTable.updatedAt,
    })
    .from(paymentsTable)
    .leftJoin(creator, eq(paymentsTable.userId, creator.id))
    .where(dateWhere(paymentsTable, from, to))
    .orderBy(desc(paymentsTable.createdAt));

  sendCsv(res, "payments",
    ["id", "user_id", "user_email", "username", "submission_id", "provider", "payment_mode", "is_demo", "amount", "currency", "status", "paypal_order_id", "external_transaction_id", "demo_confirmation_number", "created_at", "updated_at"],
    rows.map(r => [r.id, r.userId, r.userEmail, r.username, r.submissionId, r.provider, r.paymentMode, r.isDemo, r.amount, r.currency, r.status, r.paypalOrderId, r.externalTransactionId, r.demoConfirmationNumber, r.createdAt, r.updatedAt]));
});

// ── Submissions ───────────────────────────────────────────────────────────

router.get("/admin/export/submissions", requireAuth, requireRole(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const { from, to } = dateRange(req.query as Record<string, unknown>);
  const submitter = usersTable;
  const rows = await db
    .select({
      id: submissionsTable.id,
      userId: submissionsTable.userId,
      userEmail: submitter.email,
      username: submitter.username,
      userRole: submitter.role,
      type: submissionsTable.type,
      contentId: submissionsTable.contentId,
      status: submissionsTable.status,
      paymentStatus: submissionsTable.paymentStatus,
      plan: submissionsTable.plan,
      submitterNotes: submissionsTable.submitterNotes,
      moderatorNotes: submissionsTable.moderatorNotes,
      adminNotes: submissionsTable.adminNotes,
      createdAt: submissionsTable.createdAt,
      updatedAt: submissionsTable.updatedAt,
    })
    .from(submissionsTable)
    .leftJoin(submitter, eq(submissionsTable.userId, submitter.id))
    .where(dateWhere(submissionsTable, from, to))
    .orderBy(desc(submissionsTable.createdAt));

  sendCsv(res, "submissions",
    ["id", "user_id", "user_email", "username", "user_role", "type", "content_id", "status", "payment_status", "plan", "submitter_notes", "moderator_notes", "admin_notes", "created_at", "updated_at"],
    rows.map(r => [r.id, r.userId, r.userEmail, r.username, r.userRole, r.type, r.contentId, r.status, r.paymentStatus, r.plan, r.submitterNotes, r.moderatorNotes, r.adminNotes, r.createdAt, r.updatedAt]));
});

// ── Creator Support Transactions ──────────────────────────────────────────

router.get("/admin/export/support-transactions", requireAuth, requireRole(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const { from, to } = dateRange(req.query as Record<string, unknown>);
  const rows = await db
    .select()
    .from(supportTransactionsTable)
    .where(dateWhere(supportTransactionsTable, from, to))
    .orderBy(desc(supportTransactionsTable.createdAt));

  sendCsv(res, "support-transactions",
    ["id", "supporter_user_id", "recipient_user_id", "content_type", "content_id", "amount", "currency", "message", "message_visibility", "moderation_status", "transaction_ref", "provider", "mode", "status", "created_at"],
    rows.map(r => [r.id, r.supporterUserId, r.recipientUserId, r.contentType, r.contentId, r.amount, r.currency, r.message, r.messageVisibility, r.moderationStatus, r.transactionRef, r.provider, r.mode, r.status, r.createdAt]));
});

// ── Play / View History ───────────────────────────────────────────────────

router.get("/admin/export/play-history", requireAuth, requireRole(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const from = req.query.from ? new Date(String(req.query.from)) : null;
  const to   = req.query.to   ? new Date(`${String(req.query.to)}T23:59:59.999Z`) : null;
  const conditions = [];
  if (from && !isNaN(from.getTime())) conditions.push(gte(historyTable.playedAt, from));
  if (to   && !isNaN(to.getTime()))   conditions.push(lte(historyTable.playedAt, to));

  const rows = await db
    .select()
    .from(historyTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(historyTable.playedAt));

  sendCsv(res, "play-history",
    ["id", "user_id", "content_type", "content_id", "played_at"],
    rows.map(r => [r.id, r.userId, r.contentType, r.contentId, r.playedAt]));
});

// ── Users ─────────────────────────────────────────────────────────────────
// password_hash excluded intentionally.

router.get("/admin/export/users", requireAuth, requireRole(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const { from, to } = dateRange(req.query as Record<string, unknown>);
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      username: usersTable.username,
      displayName: usersTable.displayName,
      role: usersTable.role,
      isVerified: usersTable.isVerified,
      verificationType: usersTable.verificationType,
      isSuspended: usersTable.isSuspended,
      isBanned: usersTable.isBanned,
      isActive: usersTable.isActive,
      emailVerified: usersTable.emailVerified,
      realName: usersTable.realName,
      country: usersTable.country,
      state: usersTable.state,
      city: usersTable.city,
      dateOfBirth: usersTable.dateOfBirth,
      demographicsCompleted: usersTable.demographicsCompleted,
      deletionRequestedAt: usersTable.deletionRequestedAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(dateWhere(usersTable, from, to))
    .orderBy(desc(usersTable.createdAt));

  sendCsv(res, "users",
    ["id", "email", "username", "display_name", "role", "is_verified", "verification_type", "is_suspended", "is_banned", "is_active", "email_verified", "real_name", "country", "state", "city", "date_of_birth", "demographics_completed", "deletion_requested_at", "created_at"],
    rows.map(r => [r.id, r.email, r.username, r.displayName, r.role, r.isVerified, r.verificationType, r.isSuspended, r.isBanned, r.isActive, r.emailVerified, r.realName, r.country, r.state, r.city, r.dateOfBirth, r.demographicsCompleted, r.deletionRequestedAt, r.createdAt]));
});

// ── Reports ───────────────────────────────────────────────────────────────

router.get("/admin/export/reports", requireAuth, requireRole(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const { from, to } = dateRange(req.query as Record<string, unknown>);
  const rows = await db
    .select()
    .from(reportsTable)
    .where(dateWhere(reportsTable, from, to))
    .orderBy(desc(reportsTable.createdAt));

  sendCsv(res, "reports",
    ["id", "reporter_id", "target_type", "target_id", "reason", "details", "status", "reviewed_by", "reviewed_at", "admin_notes", "created_at"],
    rows.map(r => [r.id, r.reporterId, r.targetType, r.targetId, r.reason, r.details, r.status, r.reviewedBy, r.reviewedAt, r.adminNotes, r.createdAt]));
});

// ── Enforcement Actions ───────────────────────────────────────────────────

router.get("/admin/export/enforcement-actions", requireAuth, requireRole(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const { from, to } = dateRange(req.query as Record<string, unknown>);
  const rows = await db
    .select()
    .from(enforcementActionsTable)
    .where(dateWhere(enforcementActionsTable, from, to))
    .orderBy(desc(enforcementActionsTable.createdAt));

  sendCsv(res, "enforcement-actions",
    ["id", "user_id", "action_type", "reason", "notes", "issued_by_user_id", "is_automated", "status", "expires_at", "lifted_at", "report_id", "created_at"],
    rows.map(r => [r.id, r.userId, r.actionType, r.reason, r.notes, r.issuedByUserId, r.isAutomated, r.status, r.expiresAt, r.liftedAt, r.reportId, r.createdAt]));
});

// ── DMCA Claims ───────────────────────────────────────────────────────────

router.get("/admin/export/dmca-claims", requireAuth, requireRole(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const { from, to } = dateRange(req.query as Record<string, unknown>);
  const rows = await db
    .select()
    .from(dmcaClaimsTable)
    .where(dateWhere(dmcaClaimsTable, from, to))
    .orderBy(desc(dmcaClaimsTable.createdAt));

  sendCsv(res, "dmca-claims",
    ["id", "claimant_name", "claimant_email", "claimant_company", "copyright_owner", "work_description", "infringing_url", "status", "admin_notes", "created_at", "updated_at"],
    rows.map(r => [r.id, r.claimantName, r.claimantEmail, r.claimantCompany, r.copyrightOwner, r.workDescription, r.infringingUrl, r.status, r.adminNotes, r.createdAt, r.updatedAt]));
});

// ── Copyright Strikes ─────────────────────────────────────────────────────

router.get("/admin/export/copyright-strikes", requireAuth, requireRole(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const { from, to } = dateRange(req.query as Record<string, unknown>);
  const rows = await db
    .select()
    .from(copyrightStrikesTable)
    .where(dateWhere(copyrightStrikesTable, from, to))
    .orderBy(desc(copyrightStrikesTable.createdAt));

  sendCsv(res, "copyright-strikes",
    ["id", "user_id", "content_type", "content_id", "content_title", "dmca_claim_id", "strike_reason", "internal_notes", "issued_by_user_id", "status", "created_at", "resolved_at", "resolved_reason"],
    rows.map(r => [r.id, r.userId, r.contentType, r.contentId, r.contentTitle, r.dmcaClaimId, r.strikeReason, r.internalNotes, r.issuedByUserId, r.status, r.createdAt, r.resolvedAt, r.resolvedReason]));
});

// ── Follows ───────────────────────────────────────────────────────────────

router.get("/admin/export/follows", requireAuth, requireRole(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const { from, to } = dateRange(req.query as Record<string, unknown>);
  const rows = await db
    .select()
    .from(followsTable)
    .where(dateWhere(followsTable, from, to))
    .orderBy(desc(followsTable.createdAt));

  sendCsv(res, "follows",
    ["id", "follower_id", "target_type", "target_id", "created_at"],
    rows.map(r => [r.id, r.followerId, r.targetType, r.targetId, r.createdAt]));
});

// ── Agreement Acceptances ─────────────────────────────────────────────────
// Note: this table uses acceptedAt (not createdAt) as its timestamp.

router.get("/admin/export/agreement-acceptances", requireAuth, requireRole(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const parseDate = (v: unknown, endOfDay = false): Date | null => {
    if (!v) return null;
    const d = new Date(endOfDay ? `${String(v)}T23:59:59.999Z` : String(v));
    return isNaN(d.getTime()) ? null : d;
  };
  const from = parseDate(req.query.from);
  const to   = parseDate(req.query.to, true);
  const conditions = [];
  if (from) conditions.push(gte(agreementAcceptancesTable.acceptedAt, from));
  if (to)   conditions.push(lte(agreementAcceptancesTable.acceptedAt, to));

  const rows = await db
    .select()
    .from(agreementAcceptancesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(agreementAcceptancesTable.acceptedAt));

  sendCsv(res, "agreement-acceptances",
    ["id", "user_id", "agreement_type", "agreement_version", "submission_id", "payment_id", "ip_address", "user_agent", "metadata", "accepted_at"],
    rows.map(r => [r.id, r.userId, r.agreementType, r.agreementVersion, r.submissionId, r.paymentId, r.ipAddress, r.userAgent, JSON.stringify(r.metadata), r.acceptedAt]));
});

export default router;
