/**
 * Shared publish logic:
 * - Marks a song or video as "published"
 * - Finds all followers of the artist and sends them a new_release notification
 * - Used by the submission approval flow and the scheduled auto-publisher
 */
import { eq, and, lte, inArray } from "drizzle-orm";
import {
  db, songsTable, videosTable, submissionsTable,
  artistsTable, followsTable, notificationsTable, usersTable,
} from "@workspace/db";
import { logger } from "./logger";

export async function publishContent(
  type: "song" | "video",
  contentId: number,
  opts: { submissionId?: number } = {}
) {
  if (type === "song") {
    await db.update(songsTable).set({ status: "published" }).where(eq(songsTable.id, contentId));
    await sendFollowerNotifications("song", contentId, opts.submissionId);
    if (opts.submissionId) {
      await db.update(submissionsTable).set({ status: "published" }).where(eq(submissionsTable.id, opts.submissionId));
    }
  } else {
    await db.update(videosTable).set({ status: "published" }).where(eq(videosTable.id, contentId));
    await sendFollowerNotifications("video", contentId, opts.submissionId);
    if (opts.submissionId) {
      await db.update(submissionsTable).set({ status: "published" }).where(eq(submissionsTable.id, opts.submissionId));
    }
  }
}

async function sendFollowerNotifications(
  type: "song" | "video",
  contentId: number,
  submissionId?: number
) {
  // Get content details + artist
  let artistId: number | null = null;
  let contentTitle = "";
  let artistName = "";
  let coverUrl: string | null = null;

  if (type === "song") {
    const [song] = await db
      .select({ artistId: songsTable.artistId, title: songsTable.title, coverUrl: songsTable.coverUrl })
      .from(songsTable).where(eq(songsTable.id, contentId)).limit(1);
    if (!song) return;
    artistId = song.artistId;
    contentTitle = song.title;
    coverUrl = song.coverUrl;
  } else {
    const [video] = await db
      .select({ artistId: videosTable.artistId, title: videosTable.title, thumbnailUrl: videosTable.thumbnailUrl })
      .from(videosTable).where(eq(videosTable.id, contentId)).limit(1);
    if (!video) return;
    artistId = video.artistId;
    contentTitle = video.title;
    coverUrl = video.thumbnailUrl;
  }

  const [artist] = await db
    .select({ stageName: artistsTable.stageName })
    .from(artistsTable).where(eq(artistsTable.id, artistId)).limit(1);
  artistName = artist?.stageName ?? "Unknown Artist";

  // Get all followers of this artist
  const followers = await db
    .select({ followerId: followsTable.followerId })
    .from(followsTable)
    .where(and(eq(followsTable.targetType, "artist"), eq(followsTable.targetId, artistId)));

  if (!followers.length) return;

  const followerIds = followers.map((f) => f.followerId);

  const notifications = followerIds.map((userId) => ({
    userId,
    type: "new_release" as const,
    title: `${artistName} just dropped a new ${type}!`,
    message: `"${contentTitle}" is now available to ${type === "song" ? "stream" : "watch"}. Check it out!`,
    isRead: false,
    submissionId: submissionId ?? null,
  }));

  if (notifications.length) {
    await db.insert(notificationsTable).values(notifications);
    logger.info({ artistId, contentId, type, followerCount: followers.length }, "Sent release notifications to followers");
  }
}

/**
 * Scheduled job: auto-publish approved songs/videos whose releaseDate has arrived.
 * Call once at startup — runs every 60 seconds.
 */
export function startReleaseScheduler() {
  const runCheck = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      // Songs: approved, has a releaseDate <= today
      const readySongs = await db
        .select({ id: songsTable.id })
        .from(songsTable)
        .where(and(
          eq(songsTable.status, "approved"),
          lte(songsTable.releaseDate, today)
        ));

      for (const song of readySongs) {
        // Find the matching submission
        const [sub] = await db
          .select({ id: submissionsTable.id })
          .from(submissionsTable)
          .where(and(eq(submissionsTable.contentId, song.id), eq(submissionsTable.type, "song")))
          .limit(1);
        await publishContent("song", song.id, { submissionId: sub?.id });
        logger.info({ songId: song.id }, "Scheduled release: song published");
      }

      // Videos: approved, has a releaseDate <= today
      const readyVideos = await db
        .select({ id: videosTable.id })
        .from(videosTable)
        .where(and(
          eq(videosTable.status, "approved"),
          lte(videosTable.releaseDate, today)
        ));

      for (const video of readyVideos) {
        const [sub] = await db
          .select({ id: submissionsTable.id })
          .from(submissionsTable)
          .where(and(eq(submissionsTable.contentId, video.id), eq(submissionsTable.type, "video")))
          .limit(1);
        await publishContent("video", video.id, { submissionId: sub?.id });
        logger.info({ videoId: video.id }, "Scheduled release: video published");
      }
    } catch (err) {
      logger.error({ err }, "Release scheduler error");
    }
  };

  // Run immediately on startup, then every 60 seconds
  runCheck();
  setInterval(runCheck, 60_000);
}
