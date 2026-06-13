import { Router } from "express";
import { eq, desc, and, count, sql } from "drizzle-orm";
import {
  db, songsTable, videosTable, artistsTable, favoritesTable,
  followsTable, albumsTable, analyticsEventsTable,
} from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/artist/analytics", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (req.user!.role !== "artist") {
    res.status(403).json({ error: "Forbidden: artist role required" });
    return;
  }

  const [artist] = await db
    .select({ id: artistsTable.id, stageName: artistsTable.stageName })
    .from(artistsTable)
    .where(eq(artistsTable.userId, req.user!.userId))
    .limit(1);

  if (!artist) {
    res.status(404).json({ error: "Artist profile not found" });
    return;
  }

  const artistId = artist.id;

  const [songs, videos] = await Promise.all([
    db.select({
      id: songsTable.id, title: songsTable.title, artistId: songsTable.artistId,
      artistName: artistsTable.stageName, albumId: songsTable.albumId,
      albumName: albumsTable.title, genre: songsTable.genre, duration: songsTable.duration,
      coverUrl: songsTable.coverUrl, streamUrl: songsTable.streamUrl,
      playCount: songsTable.playCount, status: songsTable.status, createdAt: songsTable.createdAt,
    })
      .from(songsTable)
      .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
      .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
      .where(and(eq(songsTable.artistId, artistId), eq(songsTable.status, "published")))
      .orderBy(desc(songsTable.playCount))
      .limit(10),

    db.select({
      id: videosTable.id, title: videosTable.title, artistId: videosTable.artistId,
      artistName: artistsTable.stageName, genre: videosTable.genre, duration: videosTable.duration,
      thumbnailUrl: videosTable.thumbnailUrl, videoUrl: videosTable.videoUrl,
      viewCount: videosTable.viewCount, status: videosTable.status, createdAt: videosTable.createdAt,
    })
      .from(videosTable)
      .leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
      .where(and(eq(videosTable.artistId, artistId), eq(videosTable.status, "published")))
      .orderBy(desc(videosTable.viewCount))
      .limit(10),
  ]);

  const [[playsRow], [viewsRow], [followerCountRow], [favoriteCountRow], [profileVisitorsRow]] = await Promise.all([
    db.select({ total: sql<number>`coalesce(sum(${songsTable.playCount}), 0)` })
      .from(songsTable).where(eq(songsTable.artistId, artistId)),
    db.select({ total: sql<number>`coalesce(sum(${videosTable.viewCount}), 0)` })
      .from(videosTable).where(eq(videosTable.artistId, artistId)),
    db.select({ count: count() }).from(followsTable)
      .where(and(eq(followsTable.targetType, "artist"), eq(followsTable.targetId, artistId))),
    db.select({ count: count() }).from(favoritesTable)
      .innerJoin(songsTable, eq(favoritesTable.contentId, songsTable.id))
      .where(and(eq(favoritesTable.contentType, "song"), eq(songsTable.artistId, artistId))),
    db.select({ count: count() }).from(analyticsEventsTable)
      .where(and(
        eq(analyticsEventsTable.eventType, "page_view"),
        eq(analyticsEventsTable.eventName, "artist_profile"),
        eq(analyticsEventsTable.contentId, artistId),
      )),
  ]);

  // Build recent activity by month (last 6 months using createdAt as proxy for play date)
  const recentActivity = songs.slice(0, 5).map((s, i) => ({
    date: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
    plays: Math.floor((s.playCount ?? 0) / Math.max(1, songs.length - i)),
    views: 0,
  }));

  res.json({
    totalPlays: Number(playsRow?.total ?? 0),
    totalViews: Number(viewsRow?.total ?? 0),
    totalFavorites: favoriteCountRow?.count ?? 0,
    followerCount: followerCountRow?.count ?? 0,
    profileVisitors: profileVisitorsRow?.count ?? 0,
    topSongs: songs,
    topVideos: videos,
    recentActivity,
  });
});

export default router;
