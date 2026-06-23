import { Router } from "express";
import { eq, and, desc, count, sql, inArray } from "drizzle-orm";
import {
  db, reportsTable, feedbackTable, enforcementActionsTable, appSettingsTable,
  usersTable, notificationsTable, adminAuditLogsTable, analyticsEventsTable,
  songsTable, artistsTable,
} from "@workspace/db";
import { requireAuth, requireRole, type AuthRequest } from "../lib/auth";

const router = Router();

async function getEscalationConfig() {
  let [settings] = await db
    .select({
      autoEscalationEnabled: appSettingsTable.autoEscalationEnabled,
      strikesUntilSuspension: appSettingsTable.strikesUntilSuspension,
      autoSuspensionDays: appSettingsTable.autoSuspensionDays,
      suspensionsUntilBanReview: appSettingsTable.suspensionsUntilBanReview,
    })
    .from(appSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(appSettingsTable).values({}).returning({
      autoEscalationEnabled: appSettingsTable.autoEscalationEnabled,
      strikesUntilSuspension: appSettingsTable.strikesUntilSuspension,
      autoSuspensionDays: appSettingsTable.autoSuspensionDays,
      suspensionsUntilBanReview: appSettingsTable.suspensionsUntilBanReview,
    });
  }
  return settings;
}

// Auto-escalation: when a user accumulates enough active strikes, the system
// applies a temporary suspension; repeated suspensions are flagged for ban review.
// Returns the auto-generated suspension action when one is created, else null.
async function maybeAutoEscalate(
  target: { id: number; username: string; role: string },
  actingAdminId: number,
): Promise<typeof enforcementActionsTable.$inferSelect | null> {
  const cfg = await getEscalationConfig();
  if (!cfg.autoEscalationEnabled) return null;
  // Never auto-action staff accounts.
  if (["admin", "master_admin"].includes(target.role)) return null;

  // Don't stack on an already suspended/banned account.
  const [{ activeSuspensions }] = await db
    .select({ activeSuspensions: count() })
    .from(enforcementActionsTable)
    .where(and(
      eq(enforcementActionsTable.userId, target.id),
      eq(enforcementActionsTable.status, "active"),
      inArray(enforcementActionsTable.actionType, ["suspension", "ban"]),
    ));
  if (Number(activeSuspensions) > 0) return null;

  const [{ activeStrikes }] = await db
    .select({ activeStrikes: count() })
    .from(enforcementActionsTable)
    .where(and(
      eq(enforcementActionsTable.userId, target.id),
      eq(enforcementActionsTable.status, "active"),
      eq(enforcementActionsTable.actionType, "strike"),
    ));

  if (Number(activeStrikes) < cfg.strikesUntilSuspension) return null;

  const expiresAt = new Date(Date.now() + cfg.autoSuspensionDays * 24 * 60 * 60 * 1000);
  const reason = `Automatic suspension: reached ${cfg.strikesUntilSuspension} active strikes.`;

  const [suspension] = await db.insert(enforcementActionsTable).values({
    userId: target.id,
    actionType: "suspension",
    reason,
    notes: `System-generated escalation after ${Number(activeStrikes)} active strikes.`,
    issuedByUserId: null,
    isAutomated: true,
    status: "active",
    expiresAt,
  }).returning();

  await db.update(usersTable)
    .set({ isSuspended: true, suspendedUntil: expiresAt })
    .where(eq(usersTable.id, target.id));

  await db.insert(notificationsTable).values({
    userId: target.id,
    type: "enforcement",
    title: "⛔ Account Suspended",
    message: `${reason} Your suspension lasts until ${expiresAt.toISOString().slice(0, 10)}.`,
    isRead: false,
  });

  await db.insert(adminAuditLogsTable).values({
    adminUserId: actingAdminId,
    action: "enforcement_suspension_auto",
    targetType: "user",
    targetId: target.id,
    description: `Automatic suspension issued to @${target.username} after reaching ${cfg.strikesUntilSuspension} active strikes.`,
    metadata: { actionType: "suspension", automated: true, activeStrikes: Number(activeStrikes), durationDays: cfg.autoSuspensionDays } as unknown,
  });

  await db.insert(analyticsEventsTable).values({
    eventType: "admin",
    eventName: "enforcement_action_auto",
    userId: null,
    contentType: "user",
    contentId: target.id,
    metadata: JSON.stringify({ actionType: "suspension", automated: true }),
  });

  // Repeated suspensions → flag for ban review (does not auto-ban).
  const [{ totalSuspensions }] = await db
    .select({ totalSuspensions: count() })
    .from(enforcementActionsTable)
    .where(and(
      eq(enforcementActionsTable.userId, target.id),
      eq(enforcementActionsTable.actionType, "suspension"),
    ));

  if (Number(totalSuspensions) >= cfg.suspensionsUntilBanReview) {
    await db.insert(adminAuditLogsTable).values({
      adminUserId: actingAdminId,
      action: "ban_review_flagged",
      targetType: "user",
      targetId: target.id,
      description: `@${target.username} flagged for ban review after ${Number(totalSuspensions)} suspensions.`,
      metadata: { suspensions: Number(totalSuspensions), threshold: cfg.suspensionsUntilBanReview, automated: true } as unknown,
    });

    const masterAdmins = await db
      .select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.role, "master_admin"));
    if (masterAdmins.length) {
      await db.insert(notificationsTable).values(masterAdmins.map(a => ({
        userId: a.id,
        type: "admin" as const,
        title: "🚩 Ban Review Recommended",
        message: `@${target.username} has reached ${Number(totalSuspensions)} suspensions and is flagged for ban review.`,
        isRead: false,
      })));
    }
  }

  return suspension ?? null;
}

const ADMIN_ROLES = ["admin", "master_admin"] as const;
const MOD_ROLES = ["admin", "master_admin", "moderator"] as const;

const REPORT_TARGET_TYPES = ["song", "video", "profile", "comment", "chat_message", "private_message"];
const REPORT_REASONS = ["copyright", "harassment", "spam", "fake_profile", "illegal_content", "other"];
const FEEDBACK_TYPES = ["bug", "feature", "general"];
const ACTION_TYPES = ["warning", "strike", "suspension", "ban"];

// ── Reports (user-facing) ──────────────────────────────────────────────────

router.post("/reports", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { targetType, targetId, reason, details } = req.body as {
    targetType?: string; targetId?: number; reason?: string; details?: string;
  };
  if (!targetType || !REPORT_TARGET_TYPES.includes(targetType)) {
    res.status(400).json({ error: "Invalid targetType" }); return;
  }
  if (!targetId || Number.isNaN(Number(targetId))) {
    res.status(400).json({ error: "targetId is required" }); return;
  }
  if (!reason || !REPORT_REASONS.includes(reason)) {
    res.status(400).json({ error: "Invalid reason" }); return;
  }

  const [report] = await db.insert(reportsTable).values({
    reporterId: req.user!.userId,
    targetType,
    targetId: Number(targetId),
    reason,
    details: details?.trim() ? details.trim() : null,
    status: "pending",
  }).returning();

  await db.insert(analyticsEventsTable).values({
    eventType: "engagement",
    eventName: "report_submitted",
    userId: req.user!.userId,
    contentType: ["song", "video", "playlist", "user"].includes(targetType) ? targetType : null,
    contentId: Number(targetId),
    metadata: JSON.stringify({ targetType, reason }),
  });

  res.status(201).json(report);
});

// ── Reports (moderation queue) ─────────────────────────────────────────────

router.get("/admin/reports", requireAuth, requireRole(...MOD_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const status = typeof req.query["status"] === "string" ? String(req.query["status"]) : undefined;
  const conditions = status && status !== "all" ? [eq(reportsTable.status, status)] : [];

  const reporter = usersTable;
  const rows = await db
    .select({
      id: reportsTable.id,
      reporterId: reportsTable.reporterId,
      reporterUsername: reporter.username,
      targetType: reportsTable.targetType,
      targetId: reportsTable.targetId,
      reason: reportsTable.reason,
      details: reportsTable.details,
      status: reportsTable.status,
      adminNotes: reportsTable.adminNotes,
      reviewedBy: reportsTable.reviewedBy,
      reviewedAt: reportsTable.reviewedAt,
      createdAt: reportsTable.createdAt,
    })
    .from(reportsTable)
    .leftJoin(reporter, eq(reportsTable.reporterId, reporter.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(reportsTable.createdAt));

  res.json(rows);
});

router.patch("/admin/reports/:id", requireAuth, requireRole(...MOD_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };

  const updateData: Record<string, unknown> = {};
  if (status) {
    if (!["pending", "reviewing", "resolved", "dismissed"].includes(status)) {
      res.status(400).json({ error: "Invalid status" }); return;
    }
    updateData.status = status;
    if (status === "resolved" || status === "dismissed") {
      updateData.reviewedBy = req.user!.userId;
      updateData.reviewedAt = new Date();
    }
  }
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

  const [report] = await db.update(reportsTable).set(updateData).where(eq(reportsTable.id, id)).returning();
  if (!report) { res.status(404).json({ error: "Report not found" }); return; }

  if ((status === "resolved" || status === "dismissed") && report.reporterId) {
    const resolved = status === "resolved";
    await db.insert(notificationsTable).values({
      userId: report.reporterId,
      type: "report_update",
      title: resolved ? "✅ Your report was reviewed" : "Your report was reviewed",
      message: resolved
        ? "Thanks for helping keep Cotopia safe. Our team reviewed your report and took action."
        : "Our team reviewed your report and did not find a violation of our guidelines. Thanks for helping keep Cotopia safe.",
      isRead: false,
    });
  }

  await db.insert(adminAuditLogsTable).values({
    adminUserId: req.user!.userId,
    action: "report_triage",
    targetType: "report",
    targetId: id,
    description: `Report #${id} updated${status ? ` to ${status}` : ""}`,
    metadata: { status: status ?? null, adminNotes: adminNotes ?? null } as unknown,
  });

  res.json(report);
});

// ── Feedback (user-facing) ─────────────────────────────────────────────────

router.post("/feedback", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { type, title, description, screenshotUrl } = req.body as {
    type?: string; title?: string; description?: string; screenshotUrl?: string;
  };
  if (!type || !FEEDBACK_TYPES.includes(type)) { res.status(400).json({ error: "Invalid type" }); return; }
  if (!title?.trim()) { res.status(400).json({ error: "Title is required" }); return; }
  if (!description?.trim()) { res.status(400).json({ error: "Description is required" }); return; }

  const [feedback] = await db.insert(feedbackTable).values({
    userId: req.user!.userId,
    userRole: req.user!.role,
    type,
    title: title.trim(),
    description: description.trim(),
    screenshotUrl: screenshotUrl?.trim() ? screenshotUrl.trim() : null,
    status: "open",
  }).returning();

  const eventName = type === "bug" ? "bug_report_submitted" : type === "feature" ? "feature_request_submitted" : "feedback_submitted";
  await db.insert(analyticsEventsTable).values({
    eventType: "engagement",
    eventName,
    userId: req.user!.userId,
    metadata: JSON.stringify({ type }),
  });

  res.status(201).json(feedback);
});

router.get("/feedback/mine", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const rows = await db.select().from(feedbackTable)
    .where(eq(feedbackTable.userId, req.user!.userId))
    .orderBy(desc(feedbackTable.createdAt));
  res.json(rows);
});

// ── Feedback (admin dashboard) ─────────────────────────────────────────────

router.get("/admin/feedback", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const type = typeof req.query["type"] === "string" ? String(req.query["type"]) : undefined;
  const status = typeof req.query["status"] === "string" ? String(req.query["status"]) : undefined;
  const conditions = [];
  if (type && type !== "all") conditions.push(eq(feedbackTable.type, type));
  if (status && status !== "all") conditions.push(eq(feedbackTable.status, status));

  const submitter = usersTable;
  const rows = await db
    .select({
      id: feedbackTable.id,
      userId: feedbackTable.userId,
      username: submitter.username,
      userRole: feedbackTable.userRole,
      type: feedbackTable.type,
      title: feedbackTable.title,
      description: feedbackTable.description,
      screenshotUrl: feedbackTable.screenshotUrl,
      status: feedbackTable.status,
      adminNotes: feedbackTable.adminNotes,
      createdAt: feedbackTable.createdAt,
      updatedAt: feedbackTable.updatedAt,
    })
    .from(feedbackTable)
    .leftJoin(submitter, eq(feedbackTable.userId, submitter.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(feedbackTable.createdAt));

  res.json(rows);
});

router.patch("/admin/feedback/:id", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };

  const updateData: Record<string, unknown> = {};
  if (status) {
    if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
      res.status(400).json({ error: "Invalid status" }); return;
    }
    updateData.status = status;
  }
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

  const [feedback] = await db.update(feedbackTable).set(updateData).where(eq(feedbackTable.id, id)).returning();
  if (!feedback) { res.status(404).json({ error: "Feedback not found" }); return; }

  await db.insert(adminAuditLogsTable).values({
    adminUserId: req.user!.userId,
    action: "feedback_triage",
    targetType: "feedback",
    targetId: id,
    description: `Feedback #${id} updated${status ? ` to ${status}` : ""}`,
    metadata: { status: status ?? null, adminNotes: adminNotes ?? null } as unknown,
  });

  res.json(feedback);
});

// ── Tiered enforcement ─────────────────────────────────────────────────────

// Role gating: warning → moderator+, strike/suspension → admin+, ban → master_admin only.
function canIssue(role: string, actionType: string): boolean {
  if (actionType === "warning") return ["moderator", "admin", "master_admin"].includes(role);
  if (actionType === "strike" || actionType === "suspension") return ["admin", "master_admin"].includes(role);
  if (actionType === "ban") return role === "master_admin";
  return false;
}

router.post("/admin/enforcement", requireAuth, requireRole(...MOD_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const { userId, actionType, reason, notes, durationDays, reportId } = req.body as {
    userId?: number; actionType?: string; reason?: string; notes?: string; durationDays?: number; reportId?: number;
  };
  if (!userId || Number.isNaN(Number(userId))) { res.status(400).json({ error: "userId is required" }); return; }
  if (!actionType || !ACTION_TYPES.includes(actionType)) { res.status(400).json({ error: "Invalid actionType" }); return; }
  if (!reason?.trim()) { res.status(400).json({ error: "reason is required" }); return; }

  if (!canIssue(req.user!.role, actionType)) {
    res.status(403).json({ error: `You do not have permission to issue a ${actionType}.` });
    return;
  }

  const targetId = Number(userId);
  const [target] = await db.select({ id: usersTable.id, username: usersTable.username, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (targetId === req.user!.userId) { res.status(400).json({ error: "You cannot action your own account." }); return; }
  if (["admin", "master_admin"].includes(target.role) && req.user!.role !== "master_admin") {
    res.status(403).json({ error: "Only a master admin can action an admin account." });
    return;
  }

  let expiresAt: Date | null = null;
  if (actionType === "suspension") {
    const days = Number(durationDays);
    if (days && days > 0) expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  const [action] = await db.insert(enforcementActionsTable).values({
    userId: targetId,
    actionType,
    reason: reason.trim(),
    notes: notes?.trim() ? notes.trim() : null,
    issuedByUserId: req.user!.userId,
    status: "active",
    expiresAt,
    reportId: reportId ? Number(reportId) : null,
  }).returning();

  // Apply account-state changes for suspension/ban.
  if (actionType === "suspension") {
    await db.update(usersTable).set({ isSuspended: true, suspendedUntil: expiresAt }).where(eq(usersTable.id, targetId));
  } else if (actionType === "ban") {
    await db.update(usersTable).set({ isBanned: true, isSuspended: true }).where(eq(usersTable.id, targetId));
  }

  // Notify the user.
  const labels: Record<string, string> = {
    warning: "⚠️ Warning",
    strike: "⚠️ Strike Issued",
    suspension: "⛔ Account Suspended",
    ban: "🚫 Account Permanently Banned",
  };
  const expiryNote = expiresAt ? ` Your suspension lasts until ${expiresAt.toISOString().slice(0, 10)}.` : "";
  await db.insert(notificationsTable).values({
    userId: targetId,
    type: "enforcement",
    title: labels[actionType] ?? "Account Action",
    message: `${reason.trim()}${expiryNote}`,
    isRead: false,
  });

  await db.insert(adminAuditLogsTable).values({
    adminUserId: req.user!.userId,
    action: `enforcement_${actionType}`,
    targetType: "user",
    targetId,
    description: `${actionType} issued to @${target.username}: ${reason.trim()}`,
    metadata: { actionType, reason, durationDays: durationDays ?? null } as unknown,
  });

  await db.insert(analyticsEventsTable).values({
    eventType: "admin",
    eventName: "enforcement_action",
    userId: req.user!.userId,
    contentType: "user",
    contentId: targetId,
    metadata: JSON.stringify({ actionType }),
  });

  // Auto-escalate when a strike pushes the user over the configured threshold.
  let autoSuspension: typeof enforcementActionsTable.$inferSelect | null = null;
  if (actionType === "strike") {
    autoSuspension = await maybeAutoEscalate(target, req.user!.userId);
  }

  res.status(201).json(autoSuspension ? { ...action, autoSuspension } : action);
});

router.get("/admin/enforcement", requireAuth, requireRole(...MOD_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const userIdQ = typeof req.query["userId"] === "string" ? parseInt(req.query["userId"], 10) : NaN;
  const conditions = !Number.isNaN(userIdQ) ? [eq(enforcementActionsTable.userId, userIdQ)] : [];

  const target = usersTable;
  const rows = await db
    .select({
      id: enforcementActionsTable.id,
      userId: enforcementActionsTable.userId,
      username: target.username,
      actionType: enforcementActionsTable.actionType,
      reason: enforcementActionsTable.reason,
      notes: enforcementActionsTable.notes,
      issuedByUserId: enforcementActionsTable.issuedByUserId,
      isAutomated: enforcementActionsTable.isAutomated,
      status: enforcementActionsTable.status,
      expiresAt: enforcementActionsTable.expiresAt,
      createdAt: enforcementActionsTable.createdAt,
      liftedAt: enforcementActionsTable.liftedAt,
    })
    .from(enforcementActionsTable)
    .leftJoin(target, eq(enforcementActionsTable.userId, target.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(enforcementActionsTable.createdAt));

  res.json(rows);
});

router.patch("/admin/enforcement/:id/lift", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(enforcementActionsTable).where(eq(enforcementActionsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Action not found" }); return; }
  if (existing.actionType === "ban" && req.user!.role !== "master_admin") {
    res.status(403).json({ error: "Only a master admin can lift a ban." }); return;
  }

  const [action] = await db.update(enforcementActionsTable)
    .set({ status: "lifted", liftedAt: new Date() })
    .where(eq(enforcementActionsTable.id, id)).returning();

  // Reverse account state if this was a suspension/ban.
  if (existing.actionType === "suspension") {
    await db.update(usersTable).set({ isSuspended: false, suspendedUntil: null }).where(eq(usersTable.id, existing.userId));
  } else if (existing.actionType === "ban") {
    await db.update(usersTable).set({ isBanned: false, isSuspended: false }).where(eq(usersTable.id, existing.userId));
  }

  await db.insert(adminAuditLogsTable).values({
    adminUserId: req.user!.userId,
    action: `enforcement_${existing.actionType}_lifted`,
    targetType: "user",
    targetId: existing.userId,
    description: `${existing.actionType} #${id} lifted`,
    metadata: { actionId: id } as unknown,
  });

  res.json(action);
});

// ── Verification (artist/label) ────────────────────────────────────────────

router.post("/admin/verification", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const { userId, verified, verificationType } = req.body as {
    userId?: number; verified?: boolean; verificationType?: string | null;
  };
  if (!userId || Number.isNaN(Number(userId))) { res.status(400).json({ error: "userId is required" }); return; }

  const targetId = Number(userId);
  const [target] = await db.select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  const grant = verified !== false;
  if (grant && verificationType && !["artist", "label"].includes(verificationType)) {
    res.status(400).json({ error: "verificationType must be 'artist' or 'label'" }); return;
  }

  const [user] = await db.update(usersTable).set({
    isVerified: grant,
    verificationType: grant ? (verificationType ?? null) : null,
  }).where(eq(usersTable.id, targetId)).returning();

  await db.insert(adminAuditLogsTable).values({
    adminUserId: req.user!.userId,
    action: grant ? "verification_granted" : "verification_revoked",
    targetType: "user",
    targetId,
    description: grant
      ? `Verified ${verificationType ?? ""} status granted to @${target.username}`.trim()
      : `Verification revoked from @${target.username}`,
    metadata: { verificationType: grant ? verificationType ?? null : null } as unknown,
  });

  await db.insert(notificationsTable).values({
    userId: targetId,
    type: "verification",
    title: grant ? "✅ You're Verified!" : "Verification Removed",
    message: grant
      ? `Your account has been verified as a ${verificationType === "label" ? "Verified Label" : "Verified Artist"}.`
      : "Your verified status has been removed.",
    isRead: false,
  });

  const { passwordHash: _pw, ...userOut } = user;
  res.json(userOut);
});

// ── Message policy (user setting) ──────────────────────────────────────────

const MESSAGE_POLICIES = ["everyone", "followers_only", "verified_only", "nobody"];

router.get("/users/me/settings", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db
    .select({ messagePolicy: usersTable.messagePolicy, emailVerified: usersTable.emailVerified })
    .from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  res.json(user ?? { messagePolicy: "followers_only", emailVerified: false });
});

router.patch("/users/me/settings", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { messagePolicy } = req.body as { messagePolicy?: string };
  if (!messagePolicy || !MESSAGE_POLICIES.includes(messagePolicy)) {
    res.status(400).json({ error: "Invalid messagePolicy" }); return;
  }
  const [user] = await db.update(usersTable).set({ messagePolicy })
    .where(eq(usersTable.id, req.user!.userId)).returning();
  res.json({ messagePolicy: user.messagePolicy });
});

// ── Beta analytics ─────────────────────────────────────────────────────────

router.get("/admin/beta-analytics", requireAuth, requireRole(...ADMIN_ROLES), async (_req: AuthRequest, res): Promise<void> => {
  const [
    feedbackTotal, bugReports, featureRequests,
    totalUsers, retainedUsers,
    submissionsTotal, submissionsApproved,
    chatMessages, chatParticipants,
    pmTotal, pmSenders,
    playlistsCreated, playlistFollows,
    songCompletionRows,
  ] = await Promise.all([
    db.select({ c: count() }).from(feedbackTable).then(r => r[0]?.c ?? 0),
    db.select({ c: count() }).from(feedbackTable).where(eq(feedbackTable.type, "bug")).then(r => r[0]?.c ?? 0),
    db.select({ c: count() }).from(feedbackTable).where(eq(feedbackTable.type, "feature")).then(r => r[0]?.c ?? 0),
    db.select({ c: count() }).from(usersTable).then(r => r[0]?.c ?? 0),
    db.execute(sql`SELECT COUNT(DISTINCT u.id) AS c FROM users u JOIN analytics_events a ON a.user_id = u.id WHERE a.created_at > u.created_at + interval '1 day'`).then((r) => Number((r.rows?.[0] as { c?: number | string } | undefined)?.c ?? 0)),
    db.execute(sql`SELECT COUNT(*) AS c FROM submissions`).then((r) => Number((r.rows?.[0] as { c?: number | string } | undefined)?.c ?? 0)),
    db.execute(sql`SELECT COUNT(*) AS c FROM submissions WHERE status IN ('approved','published')`).then((r) => Number((r.rows?.[0] as { c?: number | string } | undefined)?.c ?? 0)),
    db.execute(sql`SELECT COUNT(*) AS c FROM chat_messages`).then((r) => Number((r.rows?.[0] as { c?: number | string } | undefined)?.c ?? 0)),
    db.execute(sql`SELECT COUNT(DISTINCT user_id) AS c FROM chat_messages`).then((r) => Number((r.rows?.[0] as { c?: number | string } | undefined)?.c ?? 0)),
    db.execute(sql`SELECT COUNT(*) AS c FROM direct_messages`).then((r) => Number((r.rows?.[0] as { c?: number | string } | undefined)?.c ?? 0)),
    db.execute(sql`SELECT COUNT(DISTINCT sender_id) AS c FROM direct_messages`).then((r) => Number((r.rows?.[0] as { c?: number | string } | undefined)?.c ?? 0)),
    db.execute(sql`SELECT COUNT(*) AS c FROM playlists`).then((r) => Number((r.rows?.[0] as { c?: number | string } | undefined)?.c ?? 0)),
    db.select({ c: count() }).from(analyticsEventsTable).where(eq(analyticsEventsTable.eventName, "playlist_followed")).then(r => r[0]?.c ?? 0),
    db.execute(sql`
      SELECT
        s.id        AS song_id,
        s.title     AS title,
        ar.stage_name AS artist_name,
        COUNT(CASE WHEN ae.event_name = 'song_play'     THEN 1 END)::int AS plays,
        COUNT(CASE WHEN ae.event_name = 'song_complete' THEN 1 END)::int AS completions
      FROM songs s
      JOIN artists ar ON ar.id = s.artist_id
      JOIN analytics_events ae
        ON ae.content_id = s.id AND ae.content_type = 'song'
           AND ae.event_name IN ('song_play', 'song_complete')
      GROUP BY s.id, s.title, ar.stage_name
      HAVING COUNT(CASE WHEN ae.event_name = 'song_play' THEN 1 END) > 0
      ORDER BY
        (COUNT(CASE WHEN ae.event_name = 'song_complete' THEN 1 END)::float
          / COUNT(CASE WHEN ae.event_name = 'song_play' THEN 1 END)::float) DESC,
        plays DESC
      LIMIT 100
    `).then(r => r.rows as Array<{ song_id: number; title: string; artist_name: string; plays: number; completions: number }>),
  ]);

  const songCompletionRates = songCompletionRows.map(row => ({
    songId: row.song_id,
    title: row.title,
    artistName: row.artist_name,
    plays: Number(row.plays),
    completions: Number(row.completions),
    rate: Math.round((Number(row.completions) / Number(row.plays)) * 100),
  }));

  res.json({
    feedbackTotal,
    bugReports,
    featureRequests,
    generalFeedback: feedbackTotal - bugReports - featureRequests,
    userRetention: {
      totalUsers,
      retainedUsers,
      rate: totalUsers > 0 ? Math.round((retainedUsers / totalUsers) * 100) : 0,
    },
    uploadCompletion: {
      submissionsTotal,
      submissionsApproved,
      rate: submissionsTotal > 0 ? Math.round((submissionsApproved / submissionsTotal) * 100) : 0,
    },
    chatParticipation: { messages: chatMessages, participants: chatParticipants },
    privateMessages: { total: pmTotal, senders: pmSenders },
    playlistsCreated,
    playlistFollows,
    songCompletionRates,
  });
});

export default router;
