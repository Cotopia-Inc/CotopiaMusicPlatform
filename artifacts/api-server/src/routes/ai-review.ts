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

  await logAudit(userId, "creator_tag_change", "song", songId,
    `Creator changed creation method: ${prevMethod} → ${creationMethod}`,
    { prevMethod, newMethod: creationMethod });

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
    .select({ id: videosTable.id, artistId: videosTable.artistId, tagLocked: videosTable.tagLocked, creationMethod: videosTable.creationMethod })
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

  await logAudit(userId, "creator_tag_change", "video", videoId,
    `Creator changed creation method: ${prevMethod} → ${creationMethod}`,
    { prevMethod, newMethod: creationMethod });

  res.json({ ok: true, creationMethod, effectiveDisplayTag, requiresReview: shouldEscalate });
});

// ── Admin / moderator AI review controls ─────────────────────────────────────

const adminReviewBody = z.object({
  action: z.enum([
    "assign_tag",     // set platformAssignedTag
    "lock",           // lock tag
    "unlock",         // unlock tag
    "flag",           // moderator flag for admin review
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
): Promise<{ error?: string; updated?: Record<string, unknown> }> {
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

  if (!content) return { error: "Content not found" };

  const isAdmin = (["admin", "master_admin"] as string[]).includes(adminRole);
  const isMod = adminRole === "moderator";

  const updates: Record<string, unknown> = {};

  switch (body.action) {
    case "assign_tag": {
      if (!isAdmin) return { error: "Only admins may assign a platform tag." };
      if (!body.platformAssignedTag) return { error: "platformAssignedTag is required for assign_tag" };
      if (!body.aiOverrideReason) return { error: "A written reason is required when assigning a platform tag." };
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
      if (!isAdmin) return { error: "Only admins may lock a tag." };
      if (!body.aiOverrideReason) return { error: "A written reason is required to lock a tag." };
      updates.tagLocked = true;
      updates.aiOverrideReason = body.aiOverrideReason;
      updates.aiReviewedBy = adminId;
      updates.aiReviewedAt = new Date();
      break;
    }
    case "unlock": {
      if (!isAdmin) return { error: "Only admins may unlock a tag." };
      updates.tagLocked = false;
      updates.aiReviewedBy = adminId;
      updates.aiReviewedAt = new Date();
      break;
    }
    case "flag": {
      if (!isMod && !isAdmin) return { error: "Forbidden" };
      updates.aiReviewStatus = "moderator_review";
      break;
    }
    case "escalate": {
      updates.aiReviewStatus = "escalated_to_admin";
      break;
    }
    case "request_evidence": {
      if (!isAdmin) return { error: "Only admins may request evidence." };
      updates.aiReviewStatus = "evidence_requested";
      updates.aiReviewedBy = adminId;
      updates.aiReviewedAt = new Date();
      break;
    }
    case "approve": {
      if (!isAdmin) return { error: "Only admins may approve." };
      updates.aiReviewStatus = "admin_approved";
      updates.aiReviewedBy = adminId;
      updates.aiReviewedAt = new Date();
      break;
    }
    case "reject": {
      if (!isAdmin) return { error: "Only admins may reject." };
      if (!body.aiOverrideReason) return { error: "A written reason is required to reject for AI policy." };
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
    { action: body.action, platformAssignedTag: body.platformAssignedTag, reason: body.aiOverrideReason });

  return { updated: updates };
}

router.patch(
  "/admin/ai-review/song/:id",
  requireAuth, requireRole(...STAFF_ROLES),
  async (req: AuthRequest, res): Promise<void> => {
    const parsed = adminReviewBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request", issues: parsed.error.issues }); return; }

    const result = await applyAdminReview("song", Number(req.params.id), req.user!.userId, req.user!.role, parsed.data);
    if (result.error) { res.status(result.error === "Content not found" ? 404 : 403).json({ error: result.error }); return; }
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
    if (result.error) { res.status(result.error === "Content not found" ? 404 : 403).json({ error: result.error }); return; }
    res.json({ ok: true, ...result.updated });
  },
);

// ── Hive detection scan ───────────────────────────────────────────────────────

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
    const urlField = contentType === "song" ? "streamUrl" : "videoUrl";

    const [content] = await db
      .select()
      .from(table as typeof songsTable)
      .where(eq((table as typeof songsTable).id, contentId))
      .limit(1);

    if (!content) { res.status(404).json({ error: "Content not found" }); return; }

    const mediaUrl = (content as Record<string, unknown>)[
      contentType === "song" ? "streamUrl" : "videoUrl"
    ] as string | null;

    if (!mediaUrl) {
      res.status(422).json({ error: "No media URL available to scan" });
      return;
    }

    const settings = await getSettings();

    await db.update(table as typeof songsTable)
      .set({ aiReviewStatus: "scan_pending" })
      .where(eq((table as typeof songsTable).id, contentId));

    const result = await scanWithHive(mediaUrl, {
      lowThreshold: settings?.aiLowThreshold ?? 25,
      highThreshold: settings?.aiHighThreshold ?? 60,
      criticalThreshold: settings?.aiCriticalThreshold ?? 90,
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
      requestedBy: req.user!.userId,
      scannedAt: new Date(),
    }).returning();

    if (result.available && result.aiLikelihoodPercent !== null) {
      await db.update(table as typeof songsTable).set({
        aiEstimatePercent: result.aiLikelihoodPercent,
        aiConfidenceLevel: result.confidenceLevel,
        aiRiskLevel: result.riskLevel ?? undefined,
        aiDetectionReasons: result.detectionIndicators,
        aiReviewStatus: "scan_complete",
      }).where(eq((table as typeof songsTable).id, contentId));
    } else {
      await db.update(table as typeof songsTable).set({
        aiReviewStatus: result.error ? "scan_complete" : "not_scanned",
      }).where(eq((table as typeof songsTable).id, contentId));
    }

    await logAudit(req.user!.userId, "ai_scan_triggered", contentType, contentId,
      `AI scan triggered for ${contentType} ${contentId} — provider: ${result.provider}, available: ${result.available}`,
      { scanId: scan.id, available: result.available, score: result.aiLikelihoodPercent });

    res.json({
      ok: true,
      scanId: scan.id,
      available: result.available,
      aiLikelihoodPercent: result.aiLikelihoodPercent,
      confidenceLevel: result.confidenceLevel,
      riskLevel: result.riskLevel,
      detectionIndicators: result.detectionIndicators,
      error: result.error,
      disclaimer: "Automated AI-detection results are advisory estimates and may be inaccurate. They must be evaluated together with creator disclosures, project evidence, human review, and platform policy.",
    });
  },
);

// ── Get scan history for content ──────────────────────────────────────────────

router.get(
  "/admin/ai-scans/:contentType/:contentId",
  requireAuth, requireRole(...STAFF_ROLES),
  async (req: AuthRequest, res): Promise<void> => {
    const contentType = String(req.params.contentType);
    const contentId = Number(req.params.contentId);

    if (!["song", "video"].includes(contentType)) {
      res.status(400).json({ error: "contentType must be song or video" });
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

export default router;
