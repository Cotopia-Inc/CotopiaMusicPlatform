/**
 * Background AI scan helpers — run detection scans without blocking the HTTP response.
 *
 * Call with `void scheduleScan(...)` / `void scheduleCoverScan(...)` in route handlers.
 *
 * ADVISORY: Detection results are estimates only. They must be reviewed by a
 * human together with creator disclosures and other evidence.
 */
import { eq, and } from "drizzle-orm";
import {
  db,
  songsTable,
  videosTable,
  aiDetectionScansTable,
  appSettingsTable,
  submissionsTable,
} from "@workspace/db";
import { scanWithHive } from "./hive-detection";
import { logger } from "./logger";

async function getSettings() {
  const [s] = await db.select().from(appSettingsTable).limit(1);
  return s;
}

/**
 * Fire-and-forget AI scan for a song or video media file.
 *
 * No-ops when:
 *  - `mediaUrl` is null / empty
 *  - the `enableAiReview` setting is false
 *  - provider is not configured (returns UNAVAILABLE gracefully)
 *
 * When the score meets or exceeds `autoRejectDetectionThreshold`, the content
 * and its linked submission are flagged as `auto_flagged` so reviewers see the
 * flag immediately in the admin queue.
 */
export async function scheduleScan(
  contentType: "song" | "video",
  contentId: number,
  mediaUrl: string | null,
): Promise<void> {
  if (!mediaUrl) return;

  try {
    const settings = await getSettings();
    if (!settings?.enableAiReview) return;

    const table = contentType === "song" ? songsTable : videosTable;

    await db
      .update(table as typeof songsTable)
      .set({ aiReviewStatus: "scan_pending" })
      .where(eq((table as typeof songsTable).id, contentId));

    const result = await scanWithHive(mediaUrl, {
      lowThreshold: settings.aiLowThreshold ?? 25,
      highThreshold: settings.aiHighThreshold ?? 60,
      criticalThreshold: settings.aiCriticalThreshold ?? 90,
    });

    await db.insert(aiDetectionScansTable).values({
      contentType,
      contentId,
      provider: result.provider,
      modelVersion: result.modelVersion,
      scanStatus: result.available
        ? "complete"
        : result.error
          ? "failed"
          : "unavailable",
      rawResult: result.rawResult as Record<string, unknown> | undefined,
      aiLikelihoodPercent: result.aiLikelihoodPercent ?? undefined,
      confidenceLevel: result.confidenceLevel,
      riskLevel: result.riskLevel ?? undefined,
      detectionIndicators: result.detectionIndicators,
      errorMessage: result.error ?? undefined,
      requestedBy: null,
      scannedAt: new Date(),
    });

    if (result.available && result.aiLikelihoodPercent !== null) {
      const score = result.aiLikelihoodPercent;
      const threshold = settings.autoRejectDetectionThreshold ?? 95;
      const autoFlagged = score >= threshold;

      await db
        .update(table as typeof songsTable)
        .set({
          aiEstimatePercent: score,
          aiConfidenceLevel: result.confidenceLevel,
          aiRiskLevel: result.riskLevel ?? undefined,
          aiDetectionReasons: result.detectionIndicators,
          aiReviewStatus: autoFlagged ? "auto_flagged" : "scan_complete",
        })
        .where(eq((table as typeof songsTable).id, contentId));

      if (autoFlagged) {
        await db
          .update(submissionsTable)
          .set({ aiReviewStatus: "auto_flagged" })
          .where(
            and(
              eq(submissionsTable.contentId, contentId),
              eq(submissionsTable.type, contentType),
            ),
          );

        logger.warn(
          { contentType, contentId, score, threshold },
          "AI scan auto-flagged content: score meets or exceeds autoRejectDetectionThreshold",
        );
      }
    } else {
      await db
        .update(table as typeof songsTable)
        .set({ aiReviewStatus: result.error ? "scan_complete" : "not_scanned" })
        .where(eq((table as typeof songsTable).id, contentId));
    }
  } catch (err) {
    logger.error({ err, contentType, contentId }, "Background AI scan failed");
  }
}

/**
 * Fire-and-forget AI scan for a song or video cover art image.
 *
 * Stores results in aiDetectionScansTable with contentType "song_cover" or
 * "video_cover". Does NOT update songs/videos status columns — cover art scans
 * are supplementary and reviewed separately by staff.
 *
 * No-ops when:
 *  - `imageUrl` is null / empty
 *  - the `enableAiReview` setting is false
 *  - provider is not configured (returns UNAVAILABLE gracefully)
 */
export async function scheduleCoverScan(
  contentType: "song" | "video",
  contentId: number,
  imageUrl: string | null,
): Promise<void> {
  if (!imageUrl) return;

  try {
    const settings = await getSettings();
    if (!settings?.enableAiReview) return;

    const coverContentType = `${contentType}_cover` as "song_cover" | "video_cover";

    const result = await scanWithHive(imageUrl, {
      lowThreshold: settings.aiLowThreshold ?? 25,
      highThreshold: settings.aiHighThreshold ?? 60,
      criticalThreshold: settings.aiCriticalThreshold ?? 90,
    });

    await db.insert(aiDetectionScansTable).values({
      contentType: coverContentType,
      contentId,
      provider: result.provider,
      modelVersion: result.modelVersion,
      scanStatus: result.available
        ? "complete"
        : result.error
          ? "failed"
          : "unavailable",
      rawResult: result.rawResult as Record<string, unknown> | undefined,
      aiLikelihoodPercent: result.aiLikelihoodPercent ?? undefined,
      confidenceLevel: result.confidenceLevel,
      riskLevel: result.riskLevel ?? undefined,
      detectionIndicators: result.detectionIndicators,
      errorMessage: result.error ?? undefined,
      requestedBy: null,
      scannedAt: new Date(),
    });
  } catch (err) {
    logger.error({ err, contentType, contentId }, "Background cover art AI scan failed");
  }
}
