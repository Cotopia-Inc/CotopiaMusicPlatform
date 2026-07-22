/**
 * AI / Human content origin classification routes.
 *
 * Implements creator self-tagging, admin/moderator review controls,
 * Hive detection scanning, and AI analytics.
 *
 * IMPORTANT: Detection results are advisory estimates only and must never be
 * treated as conclusive proof of AI generation. See Hive adapter for details.
 */
import { Router } from "express";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db, songsTable, videosTable, submissionsTable,
  aiDetectionScansTable, appSettingsTable, adminAuditLogsTable,
  usersTable, artistsTable,
} from "@workspace/db";
import { requireAuth, requireRole, type AuthRequest } from "../lib/auth";
import { scanWithHive } from "../lib/hive-detection";

const router = Router();

const ADMIN_ROLES = ["admin", "master_admin"] as const;
const STAFF_ROLES = ["admin", "master_admin", "editor", "moderator"] as const;

const CREATION_METHODS = [
  "unclassified",
  "human_created",
  "ai_assisted",
  "hybrid_human_ai",
  "fully_ai_generated",
  "disputed",
  "under_review",
] as const;
type CreationMethod = typeof CREATION_METHODS[number];

/** Compute effectiveDisplayTag from the priority chain. */
function resolveDisplayTag(
  tagSource: string | null,
  platformAssignedTag: string | null,
  creatorSelectedTag: string | null,
  creationMethod: string,
): string {
  if (tagSource === "appeal_decision" && platformAssignedTag) return platformAssignedTag;
  if (tagSource === "admin" && platformAssignedTag) return platformAssignedTag;
  if (creatorSelectedTag) return creatorSelectedTag;
  return creationMethod;
}

async function getSettings() {
  const [s] = await db.select().from(appSettingsTable).limit(1);
  return s;
}

async function logAudit(
  adminUserId: number,
  action: string,
  targetType: string,
  targetId: number,
  description: string,
  metadata?: Record<string, unknown>,
) {
  await db.insert(adminAuditLogsTable).values({
    adminUserId,
    action,
    targetType,
    targetId,
    description,
    metadata: metadata ?? {},
  });
}

// ── Creator self-tag ──────────────────────────────────────────────────────────

const creatorTagBody = z.object({
  creationMethod: z.enum([
    "unclassified", "human_created", "ai_assisted", "hybrid_human_ai", "fully_ai_generated",
  ]),
});

/** POST /api/songs/:id/creation-tag — creator declares origin of their song */
router.post("/songs/:id/creation-tag", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const songId = Number(req.params.id);
  const userId = req.user!.userId;

  const parsed = creatorTagBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid creation method" }); return; }

  const settings = await getSettings();
  if (!settings?.allowCreatorSelfTagging) {
    res.status(403).json({ error: "Creator self-tagging is currently disabled." });
    return;
  }

  const [song] = await db
    .select({ id: songsTable.id, artistId: songsTable.artistId, tagLocked: songsTable.tagLocked, creationMethod: songsTable.creationMethod, creatorSelectedTag: songsTable.creatorSelectedTag })
    .from(songsTable)
    .where(eq(songsTable.id, songId))
    .limit(1);
  if (!song) { res.status(404).json({ error: "Song not found" }); return; }

  const [artist] = await db
    .select({ userId: artistsTable.userId })
    .from(artistsTable)
    .where(eq(artistsTable.id, song.artistId))
    .limit(1);

  const isOwner = artist?.userId === userId;
  const isStaff = (["admin", "master_admin", "editor", "moderator"] as string[]).includes(req.user!.role);

  if (!isOwner && !isStaff) { res.status(403).json({ error: "Forbidden" }); return; }
  if (song.tagLocked && !isStaff) {
    res.status(403).json({
      error: "This classification was assigned by Everyday Radio and is locked pending administrative review or appeal.",
    });
    return;
  }

  const { creationMethod } = parsed.data;
  const prevCreatorTag = song.creatorSelectedTag;
  const prevMethod = song.creationMethod;

  const effectiveDisplayTag = resolveDisplayTag("creator", null, creationMethod, creationMethod);

  const shouldEscalate =
    prevMethod !== creationMethod &&
    !["unclassified", "human_created"].includes(creationMethod);

  const aiReviewStatus = shouldEscalate ? "moderator_review" : undefined;

  await db
    .update(songsTable)
    .set({
      creationMethod,
      creatorSelectedTag: creationMethod,
      effectiveDisplayTag,
      tagSource: "creator",
      ...(aiReviewStatus ? { aiReviewStatus } : {}),
    })
    .where(eq(songsTable.id, songId));

  await logAudit(userId, "creator_tag_set", "song", songId,
    `Creator set creation method: ${prevCreatorTag ?? prevMethod} → ${creationMethod}`,
    { before: prevCreatorTag ?? prevMethod, after: creationMethod, userId, contentType: "song", contentId: songId });

  res.json({ ok: true, creationMethod, effectiveDisplayTag, requiresReview: shouldEscalate });
});

/** POST /api/videos/:id/creation-tag — creator declares origin of their video */
router.post("/videos/:id/creation-tag", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const videoId = Number(req.params.id);
  const userId = req.user!.userId;

  const parsed = creatorTagBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid creation method" }); return; }

  const settings = await getSettings();
  if (!settings?.allowCreatorSelfTagging) {
    res.status(403).json({ error: "Creator self-tagging is currently disabled." });
    return;
  }

  const [video] = await db
    .select({ id: videosTable.id, artistId: videosTable.artistId, tagLocked: videosTable.tagLocked, creationMethod: videosTable.creationMethod, creatorSelectedTag: videosTable.creatorSelectedTag })
    .from(videosTable)
    .where(eq(videosTable.id, videoId))
    .limit(1);
  if (!video) { res.status(404).json({ error: "Video not found" }); return; }

  const [artist] = await db
    .select({ userId: artistsTable.userId })
    .from(artistsTable)
    .where(eq(artistsTable.id, video.artistId))
    .limit(1);

  const isOwner = artist?.userId === userId;
  const isStaff = (["admin", "master_admin", "editor", "moderator"] as string[]).includes(req.user!.role);

  if (!isOwner && !isStaff) { res.status(403).json({ error: "Forbidden" }); return; }
  if (video.tagLocked && !isStaff) {
    res.status(403).json({
      error: "This classification was assigned by Everyday Radio and is locked pending administrative review or appeal.",
    });
    return;
  }

  const { creationMethod } = parsed.data;
  const prevCreatorTag = video.creatorSelectedTag;
  const prevMethod = video.creationMethod;
  const effectiveDisplayTag = resolveDisplayTag("creator", null, creationMethod, creationMethod);
  const shouldEscalate = prevMethod !== creationMethod && !["unclassified", "human_created"].includes(creationMethod);

  await db
    .update(videosTable)
    .set({
      creationMethod,
      creatorSelectedTag: creationMethod,
      effectiveDisplayTag,
      tagSource: "creator",
      ...(shouldEscalate ? { aiReviewStatus: "moderator_review" } : {}),
    })
    .where(eq(videosTable.id, videoId));

  await logAudit(userId, "creator_tag_set", "video", videoId,
    `Creator set creation method: ${prevCreatorTag ?? prevMethod} → ${creationMethod}`,
    { before: prevCreatorTag ?? prevMethod, after: creationMethod, userId, contentType: "video", contentId: videoId });

  res.json({ ok: true, creationMethod, effectiveDisplayTag, requiresReview: shouldEscalate });
});

// ── Admin / moderator AI review controls ─────────────────────────────────────

const adminReviewBody = z.object({
  action: z.enum([
    "assign_tag",     // set platformAssignedTag
    "lock",           // lock tag
    "unlock",         // unlock tag
    "flag",           // moderator flag for admin review
    "recommend",      // moderator recommendation with notes (escalates to admin)
    "escalate",       // escalate to admin
    "request_evidence",
    "approve",        // admin_approved
    "reject",         // admin_rejected
  ]),
  platformAssignedTag: z.enum([
    "human_created", "ai_assisted", "hybrid_human_ai", "fully_ai_generated", "disputed", "under_review",
  ]).optional(),
  aiOverrideReason: z.string().min(1).optional(),
  moderatorNotes: z.string().optional(),
});

async function applyAdminReview(
  contentType: "song" | "video",
  contentId: number,
  adminId: number,
  adminRole: string,
  body: z.infer<typeof adminReviewBody>,
): Promise<{ error?: string; statusCode?: number; updated?: Record<string, unknown> }> {
  const table = contentType === "song" ? songsTable : videosTable;

  const [content] = await db
    .select({
      id: table.id,
      tagLocked: table.tagLocked,
      creationMethod: table.creationMethod,
      platformAssignedTag: table.platformAssignedTag,
      aiReviewStatus: table.aiReviewStatus,
    })
    .from(table as typeof songsTable)
    .where(eq((table as typeof songsTable).id, contentId))
    .limit(1);

  if (!content) return { error: "Content not found", statusCode: 404 };

  const isAdmin = (["admin", "master_admin"] as string[]).includes(adminRole);
  const isMod = adminRole === "moderator";

  const updates: Record<string, unknown> = {};

  switch (body.action) {
    case "assign_tag": {
      if (!isAdmin) return { error: "Only admins may assign a platform tag.", statusCode: 403 };
      if (!body.platformAssignedTag) return { error: "platformAssignedTag is required for assign_tag", statusCode: 400 };
      if (!body.aiOverrideReason) return { error: "A written reason is required when assigning a platform tag.", statusCode: 400 };
      updates.platformAssignedTag = body.platformAssignedTag;
      updates.tagSource = "admin";
      updates.effectiveDisplayTag = body.platformAssignedTag;
      updates.tagLocked = true;
      updates.aiOverrideReason = body.aiOverrideReason;
      updates.aiReviewStatus = "admin_approved";
      updates.aiReviewedBy = adminId;
      updates.aiReviewedAt = new Date();
      break;
    }
    case "lock": {
      if (!isAdmin) return { error: "Only admins may lock a tag.", statusCode: 403 };
      if (!body.aiOverrideReason) return { error: "A written reason is required to lock a tag.", statusCode: 400 };
      updates.tagLocked = true;
      updates.aiOverrideReason = body.aiOverrideReason;
      updates.aiReviewedBy = adminId;
      updates.aiReviewedAt = new Date();
      break;
    }
    case "unlock": {
      if (!isAdmin) return { error: "Only admins may unlock a tag.", statusCode: 403 };
      updates.tagLocked = false;
      updates.aiReviewedBy = adminId;
      updates.aiReviewedAt = new Date();
      break;
    }
    case "flag": {
      if (!isMod && !isAdmin) return { error: "Forbidden", statusCode: 403 };
      updates.aiReviewStatus = "moderator_review";
      break;
    }
    case "recommend": {
      if (!isMod && !isAdmin) return { error: "Forbidden", statusCode: 403 };
      if (!body.moderatorNotes) return { error: "A recommendation note is required for the recommend action.", statusCode: 400 };
      updates.aiReviewStatus = "escalated_to_admin";
      break;
    }
    case "escalate": {
      updates.aiReviewStatus = "escalated_to_admin";
      break;
    }
    case "request_evidence": {
      if (!isAdmin) return { error: "Only admins may request evidence.", statusCode: 403 };
      updates.aiReviewStatus = "evidence_requested";
      updates.aiReviewedBy = adminId;
      updates.aiReviewedAt = new Date();
      break;
    }
    case "approve": {
      if (!isAdmin) return { error: "Only admins may approve.", statusCode: 403 };
      updates.aiReviewStatus = "admin_approved";
      updates.aiReviewedBy = adminId;
      updates.aiReviewedAt = new Date();
      break;
    }
    case "reject": {
      if (!isAdmin) return { error: "Only admins may reject.", statusCode: 403 };
      if (!body.aiOverrideReason) return { error: "A written reason is required to reject for AI policy.", statusCode: 400 };
      updates.aiReviewStatus = "admin_rejected";
      updates.aiOverrideReason = body.aiOverrideReason;
      updates.aiReviewedBy = adminId;
      updates.aiReviewedAt = new Date();
      break;
    }
  }

  await db.update(table as typeof songsTable).set(updates).where(eq((table as typeof songsTable).id, contentId));

  await logAudit(adminId, `ai_review_${body.action}`, contentType, contentId,
    `AI review action '${body.action}' on ${contentType} ${contentId}`,
    {
      action: body.action,
      before: content.aiReviewStatus,
      after: updates.aiReviewStatus ?? content.aiReviewStatus,
      platformAssignedTag: body.platformAssignedTag,
      reason: body.aiOverrideReason,
      moderatorNotes: body.moderatorNotes,
    });

  return { updated: updates };
}

router.patch(
  "/admin/ai-review/song/:id",
  requireAuth, requireRole(...STAFF_ROLES),
  async (req: AuthRequest, res): Promise<void> => {
    const parsed = adminReviewBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request", issues: parsed.error.issues }); return; }

    const result = await applyAdminReview("song", Number(req.params.id), req.user!.userId, req.user!.role, parsed.data);
    if (result.error) { res.status(result.statusCode ?? 400).json({ error: result.error }); return; }
    res.json({ ok: true, ...result.updated });
  },
);

router.patch(
  "/admin/ai-review/video/:id",
  requireAuth, requireRole(...STAFF_ROLES),
  async (req: AuthRequest, res): Promise<void> => {
    const parsed = adminReviewBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request", issues: parsed.error.issues }); return; }

    const result = await applyAdminReview("video", Number(req.params.id), req.user!.userId, req.user!.role, parsed.data);
    if (result.error) { res.status(result.statusCode ?? 400).json({ error: result.error }); return; }
    res.json({ ok: true, ...result.updated });
  },
);

// ── URL helper ────────────────────────────────────────────────────────────────
// Hive requires a publicly reachable absolute URL. Storage paths in older
// records (pre-R2) are stored as relative paths ("/api/storage/objects/…").
// Convert them using the request's forwarded-host so Hive can fetch the file.
function makeAbsoluteUrl(url: string, req: AuthRequest): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? req.protocol ?? "https";
  const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.get("host") ?? "localhost";
  return `${proto}://${host}${url.startsWith("/") ? url : `/${url}`}`;
}

// ── Hive detection scan ───────────────────────────────────────────────────────
//
// Responds 202 immediately after marking scan_pending so the HTTP connection is
// released well before Render's / Replit's proxy timeout (~30 s). The Hive call
// and all follow-up DB writes run in a detached background task.

router.post(
  "/admin/ai-review/scan",
  requireAuth, requireRole(...STAFF_ROLES),
  async (req: AuthRequest, res): Promise<void> => {
    const body = z.object({
      contentType: z.enum(["song", "video"]),
      contentId: z.number().int().positive(),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "contentType and contentId are required" }); return; }

    const { contentType, contentId } = body.data;
    const table = contentType === "song" ? songsTable : videosTable;

    const [content] = await db
      .select()
      .from(table as typeof songsTable)
      .where(eq((table as typeof songsTable).id, contentId))
      .limit(1);

    if (!content) { res.status(404).json({ error: "Content not found" }); return; }

    const rawMediaUrl = (content as Record<string, unknown>)[
      contentType === "song" ? "streamUrl" : "videoUrl"
    ] as string | null;

    if (!rawMediaUrl) {
      res.status(422).json({ error: "No media URL available to scan" });
      return;
    }

    // Hive requires an absolute URL — convert relative paths before responding.
    const mediaUrl = makeAbsoluteUrl(rawMediaUrl, req);

    const settings = await getSettings();
    const requestedBy = req.user!.userId;

    await db.update(table as typeof songsTable)
      .set({ aiReviewStatus: "scan_pending" })
      .where(eq((table as typeof songsTable).id, contentId));

    // Mirror pending status to the associated submission so admin-submissions
    // can show the spinner and start polling scan history immediately.
    await db.update(submissionsTable)
      .set({ aiReviewStatus: "scan_pending" })
      .where(and(
        eq(submissionsTable.contentId, contentId),
        eq(submissionsTable.type, contentType),
      ))
      .catch(() => undefined);

    // Extract duration so the Hive adapter can build 60-second segments for long files.
    const durationSeconds = (content as Record<string, unknown>)["duration"] as number | undefined;

    // Respond immediately — the scan can take 10-120 s depending on file size.
    res.status(202).json({ ok: true, queued: true });

    // --- background task (fire-and-forget) ---
    void (async () => {
      try {
        const result = await scanWithHive(mediaUrl, {
          lowThreshold: settings?.aiLowThreshold ?? 25,
          highThreshold: settings?.aiHighThreshold ?? 60,
          criticalThreshold: settings?.aiCriticalThreshold ?? 90,
          durationSeconds: durationSeconds ?? 0,
        });

        const [scan] = await db.insert(aiDetectionScansTable).values({
          contentType,
          contentId,
          provider: result.provider,
          modelVersion: result.modelVersion,
          scanStatus: result.available ? "complete" : (result.error ? "failed" : "unavailable"),
          rawResult: result.rawResult as Record<string, unknown> | undefined,
          aiLikelihoodPercent: result.aiLikelihoodPercent ?? undefined,
          confidenceLevel: result.confidenceLevel,
          riskLevel: result.riskLevel ?? undefined,
          detectionIndicators: result.detectionIndicators,
          errorMessage: result.error ?? undefined,
          requestedBy,
          scannedAt: new Date(),
        }).returning();

        if (result.available && result.aiLikelihoodPercent !== null) {
          const score = result.aiLikelihoodPercent;
          const threshold = settings?.autoRejectDetectionThreshold ?? 95;
          const autoFlagged = score >= threshold;

          await db.update(table as typeof songsTable).set({
            aiEstimatePercent: score,
            aiConfidenceLevel: result.confidenceLevel,
            aiRiskLevel: result.riskLevel ?? undefined,
            aiDetectionReasons: result.detectionIndicators,
            aiReviewStatus: autoFlagged ? "auto_flagged" : "scan_complete",
          }).where(eq((table as typeof songsTable).id, contentId));

          // Mirror final status to submission (all outcomes, not just auto_flagged)
          const finalSubmissionStatus = autoFlagged ? "auto_flagged" : "scan_complete";
          await db.update(submissionsTable)
            .set({ aiReviewStatus: finalSubmissionStatus })
            .where(and(
              eq(submissionsTable.contentId, contentId),
              eq(submissionsTable.type, contentType),
            ))
            .catch(() => undefined);
        } else {
          const fallbackStatus = result.error ? "scan_complete" : "not_scanned";
          await db.update(table as typeof songsTable).set({
            aiReviewStatus: fallbackStatus,
          }).where(eq((table as typeof songsTable).id, contentId));

          await db.update(submissionsTable)
            .set({ aiReviewStatus: fallbackStatus })
            .where(and(
              eq(submissionsTable.contentId, contentId),
              eq(submissionsTable.type, contentType),
            ))
            .catch(() => undefined);
        }

        await logAudit(requestedBy, "ai_scan_triggered", contentType, contentId,
          `AI scan triggered for ${contentType} ${contentId} — provider: ${result.provider}, available: ${result.available}`,
          { scanId: scan.id, available: result.available, score: result.aiLikelihoodPercent });
      } catch (err) {
        req.log.error({ err, contentType, contentId }, "ai-review/scan background task failed");
        await db.update(table as typeof songsTable)
          .set({ aiReviewStatus: "not_scanned" })
          .where(eq((table as typeof songsTable).id, contentId))
          .catch(() => undefined);
        await db.update(submissionsTable)
          .set({ aiReviewStatus: "not_scanned" })
          .where(and(
            eq(submissionsTable.contentId, contentId),
            eq(submissionsTable.type, contentType),
          ))
          .catch(() => undefined);
      }
    })();
  },
);

// ── Cover art scan (manual trigger) ──────────────────────────────────────────
//
// Same async pattern as /scan — respond 202 immediately, scan in background.

router.post(
  "/admin/ai-review/scan-cover",
  requireAuth, requireRole(...STAFF_ROLES),
  async (req: AuthRequest, res): Promise<void> => {
    const body = z.object({
      contentType: z.enum(["song", "video"]),
      contentId: z.number().int().positive(),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "contentType and contentId are required" }); return; }

    const { contentType, contentId } = body.data;
    const table = contentType === "song" ? songsTable : videosTable;

    const [content] = await db
      .select()
      .from(table as typeof songsTable)
      .where(eq((table as typeof songsTable).id, contentId))
      .limit(1);

    if (!content) { res.status(404).json({ error: "Content not found" }); return; }

    const rawImageUrl = (content as Record<string, unknown>)[
      contentType === "song" ? "coverUrl" : "thumbnailUrl"
    ] as string | null;

    if (!rawImageUrl) {
      res.status(422).json({ error: "No cover art URL available to scan" });
      return;
    }

    // Hive requires an absolute URL — convert relative paths before responding.
    const imageUrl = makeAbsoluteUrl(rawImageUrl, req);

    const settings = await getSettings();
    const coverContentType = `${contentType}_cover` as string;
    const requestedBy = req.user!.userId;

    // Respond immediately — cover images scan faster but still need async treatment.
    res.status(202).json({ ok: true, queued: true });

    // --- background task (fire-and-forget) ---
    void (async () => {
      try {
        const result = await scanWithHive(imageUrl, {
          lowThreshold: settings?.aiLowThreshold ?? 25,
          highThreshold: settings?.aiHighThreshold ?? 60,
          criticalThreshold: settings?.aiCriticalThreshold ?? 90,
        });

        const [scan] = await db.insert(aiDetectionScansTable).values({
          contentType: coverContentType,
          contentId,
          provider: result.provider,
          modelVersion: result.modelVersion,
          scanStatus: result.available ? "complete" : (result.error ? "failed" : "unavailable"),
          rawResult: result.rawResult as Record<string, unknown> | undefined,
          aiLikelihoodPercent: result.aiLikelihoodPercent ?? undefined,
          confidenceLevel: result.confidenceLevel,
          riskLevel: result.riskLevel ?? undefined,
          detectionIndicators: result.detectionIndicators,
          errorMessage: result.error ?? undefined,
          requestedBy,
          scannedAt: new Date(),
        }).returning();

        await logAudit(requestedBy, "ai_cover_scan_triggered", contentType, contentId,
          `Cover art AI scan triggered for ${contentType} ${contentId} — available: ${result.available}`,
          { scanId: scan.id, available: result.available, score: result.aiLikelihoodPercent });
      } catch (err) {
        req.log.error({ err, contentType, contentId }, "ai-review/scan-cover background task failed");
      }
    })();
  },
);

// ── Delete a single scan record ───────────────────────────────────────────────

router.delete(
  "/admin/ai-scans/:id",
  requireAuth, requireRole(...STAFF_ROLES),
  async (req: AuthRequest, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid scan id" }); return; }

    const [deleted] = await db
      .delete(aiDetectionScansTable)
      .where(eq(aiDetectionScansTable.id, id))
      .returning({ id: aiDetectionScansTable.id });

    if (!deleted) { res.status(404).json({ error: "Scan record not found" }); return; }

    await logAudit(req.user!.userId, "ai_scan_deleted", "ai_scan", id,
      `Deleted AI scan record ${id}`);

    res.json({ ok: true });
  },
);

// ── Get scan history for content ──────────────────────────────────────────────

router.get(
  "/admin/ai-scans/:contentType/:contentId",
  requireAuth, requireRole(...STAFF_ROLES),
  async (req: AuthRequest, res): Promise<void> => {
    const contentType = String(req.params.contentType);
    const contentId = Number(req.params.contentId);

    if (!["song", "video", "song_cover", "video_cover"].includes(contentType)) {
      res.status(400).json({ error: "contentType must be song, video, song_cover, or video_cover" });
      return;
    }

    const scans = await db
      .select()
      .from(aiDetectionScansTable)
      .where(
        and(
          eq(aiDetectionScansTable.contentType, contentType),
          eq(aiDetectionScansTable.contentId, contentId),
        ),
      )
      .orderBy(desc(aiDetectionScansTable.createdAt))
      .limit(20);

    res.json(scans);
  },
);

// ── AI settings (subset) for the client ──────────────────────────────────────

router.get("/ai-settings", async (_req, res): Promise<void> => {
  const settings = await getSettings();
  if (!settings) { res.json({}); return; }
  res.json({
    showHumanBadge: settings.showHumanBadge,
    showAiBadge: settings.showAiBadge,
    showHybridBadge: settings.showHybridBadge,
    showFullyAiBadge: settings.showFullyAiBadge,
    showTitleIcons: settings.showTitleIcons,
    showCoverOverlays: settings.showCoverOverlays,
    allowCreatorSelfTagging: settings.allowCreatorSelfTagging,
    enableAiReview: settings.enableAiReview,
    autoRejectFullyAi: settings.autoRejectFullyAi,
    aiLowThreshold: settings.aiLowThreshold,
    aiHighThreshold: settings.aiHighThreshold,
    aiCriticalThreshold: settings.aiCriticalThreshold,
    hiveConfigured: !!process.env.HIVE_API_KEY,
  });
});

// ── AI analytics ─────────────────────────────────────────────────────────────

router.get(
  "/admin/ai-analytics",
  requireAuth, requireRole(...STAFF_ROLES),
  async (_req, res): Promise<void> => {
    const [songCounts, videoCounts, scanStats] = await Promise.all([
      db.select({
        creationMethod: songsTable.creationMethod,
        total: count(),
        locked: sql<number>`sum(case when ${songsTable.tagLocked} then 1 else 0 end)::int`,
      })
        .from(songsTable)
        .groupBy(songsTable.creationMethod),

      db.select({
        creationMethod: videosTable.creationMethod,
        total: count(),
        locked: sql<number>`sum(case when ${videosTable.tagLocked} then 1 else 0 end)::int`,
      })
        .from(videosTable)
        .groupBy(videosTable.creationMethod),

      db.select({
        scanStatus: aiDetectionScansTable.scanStatus,
        total: count(),
      })
        .from(aiDetectionScansTable)
        .groupBy(aiDetectionScansTable.scanStatus),
    ]);

    res.json({
      songs: songCounts,
      videos: videoCounts,
      scans: scanStats,
      disclaimer: "These figures reflect current database state. Do not expose individual detection scores publicly without master_admin authorization.",
    });
  },
);

// ── Hive connectivity check ───────────────────────────────────────────────────
// Returns whether the HIVE_API_KEY env var is set. Does not attempt a real
// scan (no media URL available here); use the manual scan button for a live test.

router.get(
  "/admin/ai-review/hive-status",
  requireAuth, requireRole(...STAFF_ROLES),
  async (_req, res): Promise<void> => {
    const configured = !!process.env.HIVE_API_KEY;
    if (!configured) {
      res.json({ configured: false, status: "not_configured", message: "AI detection API key is not set in environment variables." });
      return;
    }

    // Attempt a lightweight auth-check against the V3 API.
    // A 401 means the key is invalid; any other response means the key is accepted.
    try {
      const probe = await fetch("https://api.thehive.ai/api/v3/hive/ai-generated-and-deepfake-content-detection", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HIVE_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ input: [{ media_url: "https://example.com/__key_check__" }] }),
        signal: AbortSignal.timeout(10_000),
      });

      if (probe.status === 401) {
        res.json({ configured: true, status: "invalid_key", message: "AI detection API key is set but was rejected (401 Unauthorized). Check that the key is correct." });
        return;
      }

      // Any non-401 response (even 4xx for bad URL) means the key is accepted.
      res.json({ configured: true, status: "ok", message: `AI detection API key accepted (HTTP ${probe.status}).` });
    } catch (err) {
      res.json({ configured: true, status: "unreachable", message: `AI detection API key is set but provider could not be reached: ${err instanceof Error ? err.message : "network error"}` });
    }
  },
);

export default router;
