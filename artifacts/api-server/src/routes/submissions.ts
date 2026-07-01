import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, submissionsTable, usersTable, songsTable, videosTable, artistsTable, notificationsTable, adminAuditLogsTable } from "@workspace/db";
import {
  CreateSubmissionBody, GetSubmissionParams,
  UpdateSubmissionParams, UpdateSubmissionBody,
  CreateBulkSubmissionBody,
  ReviewSubmissionParams, ReviewSubmissionBody,
} from "@workspace/api-zod";
import { requireAuth, requireVerifiedEmail, type AuthRequest } from "../lib/auth";
import { publishContent } from "../lib/publisher";
import { awardBadgeByName } from "./badges";

const BETA_END_DATE = new Date("2026-12-31T23:59:59Z");

const router = Router();

async function enrichSubmission(s: typeof submissionsTable.$inferSelect) {
  const [user] = await db.select({ username: usersTable.username, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, s.userId)).limit(1);
  let title = "";
  let mediaUrl: string | null = null;
  let coverUrl: string | null = null;
  if (s.contentId) {
    if (s.type === "song") {
      const [song] = await db.select({ title: songsTable.title, streamUrl: songsTable.streamUrl, coverUrl: songsTable.coverUrl }).from(songsTable).where(eq(songsTable.id, s.contentId)).limit(1);
      title = song?.title ?? "";
      mediaUrl = song?.streamUrl ?? null;
      coverUrl = song?.coverUrl ?? null;
    } else {
      const [video] = await db.select({ title: videosTable.title, videoUrl: videosTable.videoUrl, thumbnailUrl: videosTable.thumbnailUrl }).from(videosTable).where(eq(videosTable.id, s.contentId)).limit(1);
      title = video?.title ?? "";
      mediaUrl = video?.videoUrl ?? null;
      coverUrl = video?.thumbnailUrl ?? null;
    }
  }
  return { ...s, submitterName: user?.username ?? "", submitterRole: user?.role ?? "", title, mediaUrl, coverUrl };
}

router.get("/submissions", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const conditions = req.user!.role === "admin"
    ? []
    : [eq(submissionsTable.userId, req.user!.userId)];

  const submissions = await db.select().from(submissionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(submissionsTable.createdAt));

  const enriched = await Promise.all(submissions.map(enrichSubmission));
  res.json(enriched);
});

router.post("/submissions", requireAuth, requireVerifiedEmail, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateSubmissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;

  // Find or auto-create an artist profile for any authenticated user.
  let [artist] = await db.select().from(artistsTable).where(eq(artistsTable.userId, req.user!.userId)).limit(1);
  if (!artist) {
    const [user] = await db.select({ username: usersTable.username, displayName: usersTable.displayName }).from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    const stageName = user?.displayName || user?.username || "Unknown Artist";
    [artist] = await db.insert(artistsTable).values({
      userId: req.user!.userId,
      stageName,
    }).returning();
  }

  // Extra metadata stored as JSON
  const metaFields = {
    labelName: d.labelName,
    mood: d.mood,
    description: d.description,
    credits: d.credits,
    releaseDate: d.releaseDate,
    isExplicit: d.isExplicit ?? false,
    artistName: d.artistName,
  };
  const submitterNotes = JSON.stringify(metaFields);

  let contentId: number;

  if (d.type === "song") {
    const [song] = await db.insert(songsTable).values({
      artistId: artist.id,
      title: d.title,
      genre: d.genre ?? null,
      coverUrl: d.coverUrl ?? null,
      streamUrl: d.fileUrl ?? null,
      status: "draft",
      duration: 0,
      releaseDate: d.releaseDate ?? null,
      lyrics: d.lyrics ?? null,
      credits: d.credits ?? null,
    }).returning();
    contentId = song.id;
  } else {
    const [video] = await db.insert(videosTable).values({
      artistId: artist.id,
      title: d.title,
      genre: d.genre ?? null,
      description: d.description ?? null,
      thumbnailUrl: d.coverUrl ?? null,
      videoUrl: d.fileUrl ?? null,
      status: "draft",
      duration: 0,
      releaseDate: d.releaseDate ?? null,
      credits: d.credits ?? null,
    }).returning();
    contentId = video.id;
  }

  const [submission] = await db.insert(submissionsTable).values({
    userId: req.user!.userId,
    type: d.type,
    contentId,
    plan: d.plan ?? "basic",
    status: "draft",
    paymentStatus: "unpaid",
    submitterNotes,
  }).returning();

  const enriched = await enrichSubmission(submission);
  res.status(201).json(enriched);
});

router.post("/submissions/bulk", requireAuth, requireVerifiedEmail, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateBulkSubmissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;

  // Find or auto-create an artist profile for any authenticated user.
  let [artist] = await db.select().from(artistsTable).where(eq(artistsTable.userId, req.user!.userId)).limit(1);
  if (!artist) {
    const [user] = await db.select({ username: usersTable.username, displayName: usersTable.displayName }).from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    const stageName = user?.displayName || user?.username || "Unknown Artist";
    [artist] = await db.insert(artistsTable).values({
      userId: req.user!.userId,
      stageName,
    }).returning();
  }

  const metaFields = {
    labelName: d.labelName,
    mood: d.mood,
    description: d.description,
    credits: d.credits,
    releaseDate: d.releaseDate,
    isExplicit: d.isExplicit ?? false,
    artistName: d.artistName,
  };
  const submitterNotes = JSON.stringify(metaFields);

  const results: object[] = [];

  for (const file of d.files) {
    let contentId: number;

    if (d.type === "song") {
      const [song] = await db.insert(songsTable).values({
        artistId: artist.id,
        title: file.title,
        genre: d.genre ?? null,
        coverUrl: d.coverUrl ?? null,
        streamUrl: file.fileUrl,
        status: "draft",
        duration: 0,
        releaseDate: d.releaseDate ?? null,
        lyrics: d.lyrics ?? null,
        credits: d.credits ?? null,
      }).returning();
      contentId = song.id;
    } else {
      const [video] = await db.insert(videosTable).values({
        artistId: artist.id,
        title: file.title,
        genre: d.genre ?? null,
        description: d.description ?? null,
        thumbnailUrl: d.coverUrl ?? null,
        videoUrl: file.fileUrl,
        status: "draft",
        duration: 0,
        releaseDate: d.releaseDate ?? null,
        credits: d.credits ?? null,
      }).returning();
      contentId = video.id;
    }

    const [submission] = await db.insert(submissionsTable).values({
      userId: req.user!.userId,
      type: d.type,
      contentId,
      plan: d.plan ?? "basic",
      status: "draft",
      paymentStatus: "unpaid",
      submitterNotes,
    }).returning();

    results.push(await enrichSubmission(submission));
  }

  res.status(201).json(results);
});

router.get("/submissions/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetSubmissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, params.data.id)).limit(1);
  if (!submission) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  const enriched = await enrichSubmission(submission);
  res.json(enriched);
});

router.patch("/submissions/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  // Legacy admin path. Publish/approve/reject for moderators & editors is gated
  // through POST /submissions/:id/review — keep this admin-only to avoid bypass.
  const reviewerRoles = ["admin", "master_admin"];
  if (!reviewerRoles.includes(req.user!.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const params = UpdateSubmissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSubmissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingBeforeUpdate] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, params.data.id)).limit(1);

  // Payment guard: admins cannot approve or publish an unpaid submission.
  const isApprovalAction = parsed.data.status === "approved" || parsed.data.status === "published";
  if (isApprovalAction && existingBeforeUpdate.paymentStatus !== "paid") {
    res.status(403).json({ error: "This submission has not been paid for and cannot be approved or published." });
    return;
  }

  const [submission] = await db.update(submissionsTable)
    .set({ ...parsed.data })
    .where(eq(submissionsTable.id, params.data.id))
    .returning();

  // ── Approval flow ────────────────────────────────────────────────────────
  if (parsed.data.status === "approved" && submission.contentId) {
    const enriched = await enrichSubmission(submission);

    // Parse releaseDate from submitterNotes JSON
    let releaseDate: string | null = null;
    try {
      const meta = JSON.parse(submission.submitterNotes ?? "{}");
      if (meta.releaseDate) releaseDate = meta.releaseDate as string;
    } catch { /* ignore */ }

    const today = new Date().toISOString().slice(0, 10);
    const hasFutureDate = releaseDate && releaseDate > today;

    if (hasFutureDate) {
      // Store releaseDate on the content row and leave it as "approved" (not published yet)
      if (submission.type === "song") {
        await db.update(songsTable).set({ status: "approved", releaseDate }).where(eq(songsTable.id, submission.contentId));
      } else {
        await db.update(videosTable).set({ status: "approved", releaseDate }).where(eq(videosTable.id, submission.contentId));
      }

      // Notify the submitter of the scheduled release date
      await db.insert(notificationsTable).values({
        userId: submission.userId,
        type: "submission_approved",
        title: `"${enriched.title}" approved — scheduled for ${releaseDate}`,
        message: parsed.data.adminNotes
          ? `Admin note: ${parsed.data.adminNotes}. Your content will go live on ${releaseDate}.`
          : `Your content is approved and will be published automatically on ${releaseDate}. Stay tuned!`,
        submissionId: submission.id,
        isRead: false,
      });
    } else {
      // No future date — publish immediately
      await publishContent(submission.type as "song" | "video", submission.contentId, { submissionId: submission.id });

      // Notify submitter
      await db.insert(notificationsTable).values({
        userId: submission.userId,
        type: "submission_approved",
        title: `"${enriched.title}" is now live!`,
        message: parsed.data.adminNotes
          ? `Admin note: ${parsed.data.adminNotes}`
          : "Your submission has been approved and published. Thanks for your contribution!",
        submissionId: submission.id,
        isRead: false,
      });
    }
  }

  // ── Rejection flow ───────────────────────────────────────────────────────
  if (parsed.data.status === "rejected") {
    const enriched = await enrichSubmission(submission);
    await db.insert(notificationsTable).values({
      userId: submission.userId,
      type: "submission_rejected",
      title: `"${enriched.title}" was not approved`,
      message: parsed.data.adminNotes
        ? `Admin note: ${parsed.data.adminNotes}`
        : "Your submission did not meet our current requirements. You're welcome to revise and resubmit.",
      submissionId: submission.id,
      isRead: false,
    });
  }

  // ── Manual publish (legacy path) ─────────────────────────────────────────
  if (parsed.data.status === "published" && submission.contentId) {
    await publishContent(submission.type as "song" | "video", submission.contentId, { submissionId: submission.id });
  }

  const enriched = await enrichSubmission(submission);
  res.json(enriched);
});

router.delete("/submissions/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetSubmissionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, params.data.id)).limit(1);
  if (!submission) { res.status(404).json({ error: "Submission not found" }); return; }

  const isAdmin = req.user!.role === "admin" || req.user!.role === "master_admin" || req.user!.role === "editor";
  if (!isAdmin && submission.userId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(submissionsTable).where(eq(submissionsTable.id, params.data.id));
  res.sendStatus(204);
});

// ── Role-based review workflow ───────────────────────────────────────────────
const MODERATOR_ACTIONS = ["moderator_approve", "moderator_reject", "escalate", "moderator_note"] as const;
const ADMIN_ACTIONS = ["admin_publish", "admin_reject", "return_to_moderator", "flag_legal", "admin_note"] as const;
const EDITOR_ACTIONS = ["editor_recommend", "editor_note"] as const;

const ADMIN_ROLES = ["admin", "master_admin"];

function rolesForAction(action: string): string[] {
  if ((MODERATOR_ACTIONS as readonly string[]).includes(action)) return ["moderator", ...ADMIN_ROLES];
  if ((ADMIN_ACTIONS as readonly string[]).includes(action)) return ADMIN_ROLES;
  if ((EDITOR_ACTIONS as readonly string[]).includes(action)) return ["editor", ...ADMIN_ROLES];
  return [];
}

router.post("/submissions/:id/review", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = ReviewSubmissionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = ReviewSubmissionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { action } = parsed.data;
  const notes = parsed.data.notes?.trim() || undefined;
  const role = req.user!.role;

  const allowedRoles = rolesForAction(action);
  if (!allowedRoles.includes(role)) {
    res.status(403).json({ error: "Your role cannot perform this action." });
    return;
  }

  const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, params.data.id)).limit(1);
  if (!submission) { res.status(404).json({ error: "Submission not found" }); return; }

  // State-machine guards: prevent acting on submissions in the wrong stage.
  const TERMINAL = ["published", "rejected", "moderator_rejected"];
  const MOD_STATE_CHANGING = ["moderator_approve", "moderator_reject", "escalate"];
  const ADMIN_STATE_CHANGING = ["admin_publish", "admin_reject", "return_to_moderator"];

  // Payment guard: no state-changing review action is allowed on an unpaid submission.
  // This closes the loophole where an admin could publish a draft that never went through payment.
  const ALL_STATE_CHANGING = [...MOD_STATE_CHANGING, ...ADMIN_STATE_CHANGING];
  if (ALL_STATE_CHANGING.includes(action) && submission.paymentStatus !== "paid") {
    res.status(403).json({ error: "This submission has not been paid for and cannot enter the review workflow." });
    return;
  }

  if (MOD_STATE_CHANGING.includes(action) && submission.status !== "pending_moderator_review") {
    res.status(409).json({ error: "This submission is no longer awaiting moderator review." });
    return;
  }
  if (ADMIN_STATE_CHANGING.includes(action) && TERMINAL.includes(submission.status)) {
    res.status(409).json({ error: "This submission has already been finalized." });
    return;
  }

  const enrichedBefore = await enrichSubmission(submission);
  const title = enrichedBefore.title || `Submission #${submission.id}`;

  // Resolve scheduled release date from submitter metadata (for publishing)
  let releaseDate: string | null = null;
  try {
    const meta = JSON.parse(submission.submitterNotes ?? "{}");
    if (meta.releaseDate) releaseDate = meta.releaseDate as string;
  } catch { /* ignore */ }
  const today = new Date().toISOString().slice(0, 10);
  const hasFutureDate = !!releaseDate && releaseDate > today;

  const update: Partial<typeof submissionsTable.$inferInsert> = {};
  let auditAction = "";
  let auditDescription = "";
  let notification: { type: string; title: string; message: string } | null = null;

  switch (action) {
    case "moderator_approve":
      update.status = "pending_admin_final_review";
      if (notes) update.moderatorNotes = notes;
      auditAction = "submission_moderator_approved";
      auditDescription = `Moderator approved "${title}" for admin final review`;
      break;

    case "moderator_reject":
      update.status = "moderator_rejected";
      if (notes) update.moderatorNotes = notes;
      auditAction = "submission_moderator_rejected";
      auditDescription = `Moderator rejected "${title}" as spam/policy violation`;
      notification = {
        type: "submission_rejected",
        title: `"${title}" was not approved`,
        message: notes
          ? `Moderator note: ${notes}`
          : "Your submission was rejected for a community guideline or spam violation.",
      };
      break;

    case "escalate":
      update.status = "escalated_to_admin";
      if (notes) update.moderatorNotes = notes;
      auditAction = "submission_escalated";
      auditDescription = `Moderator escalated "${title}" to admin`;
      break;

    case "moderator_note":
      update.moderatorNotes = notes ?? "";
      auditAction = "submission_moderator_note";
      auditDescription = `Moderator added a note to "${title}"`;
      break;

    case "admin_publish":
      if (!submission.contentId) { res.status(400).json({ error: "Submission has no content to publish" }); return; }
      if (notes) update.adminNotes = notes;
      auditAction = "submission_published";
      // Auto-award badges to the actual content owner (artist userId), not the submitter.
      // When an admin uploads on behalf of an artist the submission.userId is the admin's id;
      // the real owner is identified via the linked song/video's artistId.
      {
        const contentId = submission.contentId;
        const contentType = submission.type;
        (async () => {
          try {
            let ownerUserId: number | null = null;
            if (contentType === "song") {
              const [row] = await db.select({ userId: artistsTable.userId })
                .from(songsTable)
                .leftJoin(artistsTable, eq(artistsTable.id, songsTable.artistId))
                .where(eq(songsTable.id, contentId))
                .limit(1);
              ownerUserId = row?.userId ?? null;
            } else {
              const [row] = await db.select({ userId: artistsTable.userId })
                .from(videosTable)
                .leftJoin(artistsTable, eq(artistsTable.id, videosTable.artistId))
                .where(eq(videosTable.id, contentId))
                .limit(1);
              ownerUserId = row?.userId ?? null;
            }
            const awardTo = ownerUserId ?? submission.userId;
            await awardBadgeByName(awardTo, "First Upload", { reason: "First approved submission" });
            if (new Date() <= BETA_END_DATE) {
              await awardBadgeByName(awardTo, "Founding Artist", { reason: "Content approved during founding beta period" });
            }
          } catch (err) {
            req.log.error(err, "Failed to auto-award badge on admin_publish");
          }
        })();
      }
      if (hasFutureDate) {
        update.status = "admin_approved";
        if (submission.type === "song") {
          await db.update(songsTable).set({ status: "approved", releaseDate }).where(eq(songsTable.id, submission.contentId));
        } else {
          await db.update(videosTable).set({ status: "approved", releaseDate }).where(eq(videosTable.id, submission.contentId));
        }
        auditDescription = `Admin approved "${title}" — scheduled to publish on ${releaseDate}`;
        notification = {
          type: "submission_approved",
          title: `"${title}" approved — scheduled for ${releaseDate}`,
          message: notes
            ? `Admin note: ${notes}. Your content will go live on ${releaseDate}.`
            : `Your content is approved and will be published automatically on ${releaseDate}.`,
        };
      } else {
        await publishContent(submission.type as "song" | "video", submission.contentId, { submissionId: submission.id });
        // publishContent already set status to "published"; keep update consistent
        update.status = "published";
        auditDescription = `Admin published "${title}"`;
        notification = {
          type: "submission_approved",
          title: `"${title}" is now live!`,
          message: notes ? `Admin note: ${notes}` : "Your submission has been approved and published. Thanks!",
        };
      }
      break;

    case "admin_reject":
      update.status = "rejected";
      if (notes) update.adminNotes = notes;
      auditAction = "submission_admin_rejected";
      auditDescription = `Admin rejected "${title}"`;
      notification = {
        type: "submission_rejected",
        title: `"${title}" was not approved`,
        message: notes ? `Admin note: ${notes}` : "Your submission did not meet our requirements. You're welcome to revise and resubmit.",
      };
      break;

    case "return_to_moderator":
      update.status = "pending_moderator_review";
      if (notes) update.adminNotes = notes;
      auditAction = "submission_returned_to_moderator";
      auditDescription = `Admin returned "${title}" to the moderation queue`;
      break;

    case "flag_legal":
      update.status = "escalated_to_admin";
      if (notes) update.adminNotes = notes;
      auditAction = "submission_legal_flag";
      auditDescription = `Admin flagged a legal/copyright concern on "${title}"`;
      break;

    case "admin_note":
      update.adminNotes = notes ?? "";
      auditAction = "submission_admin_note";
      auditDescription = `Admin added a note to "${title}"`;
      break;

    case "editor_recommend":
      if (notes) update.adminNotes = notes;
      auditAction = "submission_editor_recommend";
      auditDescription = `Editor recommended "${title}" for featured/playlist placement`;
      break;

    case "editor_note":
      if (notes) update.adminNotes = notes;
      auditAction = "submission_editor_note";
      auditDescription = `Editor left an editorial note on "${title}"`;
      break;
  }

  const [updated] = Object.keys(update).length
    ? await db.update(submissionsTable).set(update).where(eq(submissionsTable.id, submission.id)).returning()
    : [submission];

  await db.insert(adminAuditLogsTable).values({
    adminUserId: req.user!.userId,
    action: auditAction,
    targetType: "submission",
    targetId: submission.id,
    description: auditDescription,
    metadata: { action, notes, role, newStatus: update.status ?? submission.status } as unknown,
  });

  if (notification) {
    await db.insert(notificationsTable).values({
      userId: submission.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      submissionId: submission.id,
      isRead: false,
    });
  }

  req.log.info({ submissionId: submission.id, action, role }, "Submission review action");

  const enriched = await enrichSubmission(updated);
  res.json(enriched);
});

export default router;
