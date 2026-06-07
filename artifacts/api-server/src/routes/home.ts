import { Router } from "express";
import { eq, desc, and, avg } from "drizzle-orm";
import { db, songsTable, videosTable, artistsTable, labelsTable, albumsTable, companyPostsTable, followsTable, ratingsTable } from "@workspace/db";
import { count } from "drizzle-orm";

const router = Router();

router.get("/home", async (_req, res): Promise<void> => {
  const songSelect = {
    id: songsTable.id, title: songsTable.title, artistId: songsTable.artistId,
    artistName: artistsTable.stageName, albumId: songsTable.albumId,
    albumName: albumsTable.title, genre: songsTable.genre, duration: songsTable.duration,
    coverUrl: songsTable.coverUrl, streamUrl: songsTable.streamUrl,
    playCount: songsTable.playCount, status: songsTable.status, createdAt: songsTable.createdAt,
  };

  const videoSelect = {
    id: videosTable.id, title: videosTable.title, artistId: videosTable.artistId,
    artistName: artistsTable.stageName, genre: videosTable.genre, duration: videosTable.duration,
    thumbnailUrl: videosTable.thumbnailUrl, videoUrl: videosTable.videoUrl,
    viewCount: videosTable.viewCount, status: videosTable.status, createdAt: videosTable.createdAt,
  };

  const [featuredSongs, featuredVideos, trendingSongs, newReleases] = await Promise.all([
    db.select(songSelect).from(songsTable).leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id)).leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id)).where(and(eq(songsTable.isFeatured, true), eq(songsTable.status, "published"))).orderBy(desc(songsTable.createdAt)).limit(6),
    db.select(videoSelect).from(videosTable).leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id)).where(and(eq(videosTable.isFeatured, true), eq(videosTable.status, "published"))).orderBy(desc(videosTable.createdAt)).limit(4),
    db.select(songSelect).from(songsTable).leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id)).leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id)).where(eq(songsTable.status, "published")).orderBy(desc(songsTable.playCount)).limit(10),
    db.select(songSelect).from(songsTable).leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id)).leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id)).where(eq(songsTable.status, "published")).orderBy(desc(songsTable.createdAt)).limit(8),
  ]);

  const [rawArtists, rawLabels, announcements] = await Promise.all([
    db.select({ id: artistsTable.id, userId: artistsTable.userId, stageName: artistsTable.stageName, bio: artistsTable.bio, avatarUrl: artistsTable.avatarUrl, bannerUrl: artistsTable.bannerUrl, genre: artistsTable.genre, labelId: artistsTable.labelId, createdAt: artistsTable.createdAt }).from(artistsTable).orderBy(desc(artistsTable.createdAt)).limit(6),
    db.select().from(labelsTable).orderBy(desc(labelsTable.createdAt)).limit(4),
    db.select().from(companyPostsTable).orderBy(desc(companyPostsTable.isPinned), desc(companyPostsTable.createdAt)).limit(3),
  ]);

  const addRatingToSong = async (s: typeof featuredSongs[0]) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable).where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id)));
    return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null };
  };
  const addRatingToVideo = async (v: typeof featuredVideos[0]) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable).where(and(eq(ratingsTable.contentType, "video"), eq(ratingsTable.contentId, v.id)));
    return { ...v, avgRating: r?.avg ? parseFloat(r.avg) : null };
  };

  const featuredArtists = await Promise.all(rawArtists.map(async (a) => {
    const [fc] = await db.select({ count: count() }).from(followsTable).where(and(eq(followsTable.targetType, "artist"), eq(followsTable.targetId, a.id)));
    const [sc] = await db.select({ count: count() }).from(songsTable).where(and(eq(songsTable.artistId, a.id), eq(songsTable.status, "published")));
    return { ...a, followerCount: fc?.count ?? 0, songCount: sc?.count ?? 0, isFollowed: false };
  }));

  const featuredLabels = await Promise.all(rawLabels.map(async (l) => {
    const [fc] = await db.select({ count: count() }).from(followsTable).where(and(eq(followsTable.targetType, "label"), eq(followsTable.targetId, l.id)));
    const [ac] = await db.select({ count: count() }).from(artistsTable).where(eq(artistsTable.labelId, l.id));
    return { ...l, followerCount: fc?.count ?? 0, artistCount: ac?.count ?? 0, isFollowed: false };
  }));

  res.json({
    featuredSongs: await Promise.all(featuredSongs.map(addRatingToSong)),
    featuredVideos: await Promise.all(featuredVideos.map(addRatingToVideo)),
    featuredArtists,
    featuredLabels,
    trendingSongs: await Promise.all(trendingSongs.map(addRatingToSong)),
    newReleases: await Promise.all(newReleases.map(addRatingToSong)),
    announcements,
  });
});

export default router;
