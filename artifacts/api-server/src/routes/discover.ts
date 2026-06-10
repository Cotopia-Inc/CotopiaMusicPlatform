import { Router } from "express";
import { eq, desc, and, avg, count, sql } from "drizzle-orm";
import { db, songsTable, videosTable, artistsTable, labelsTable, albumsTable, ratingsTable, commentsTable, followsTable, usersTable } from "@workspace/db";

const router = Router();

router.get("/discover", async (_req, res): Promise<void> => {
  const songSelect = {
    id: songsTable.id, title: songsTable.title, artistId: songsTable.artistId,
    artistName: artistsTable.stageName, albumId: songsTable.albumId,
    albumName: albumsTable.title, genre: songsTable.genre, duration: songsTable.duration,
    coverUrl: songsTable.coverUrl, streamUrl: songsTable.streamUrl,
    playCount: songsTable.playCount, status: songsTable.status, createdAt: songsTable.createdAt,
    artistIsVerified: usersTable.isVerified,
  };

  const videoSelect = {
    id: videosTable.id, title: videosTable.title, artistId: videosTable.artistId,
    artistName: artistsTable.stageName, genre: videosTable.genre, duration: videosTable.duration,
    thumbnailUrl: videosTable.thumbnailUrl, videoUrl: videosTable.videoUrl,
    viewCount: videosTable.viewCount, status: videosTable.status, createdAt: videosTable.createdAt,
    artistIsVerified: usersTable.isVerified,
  };

  const [trendingSongs, trendingVideos] = await Promise.all([
    db.select(songSelect).from(songsTable).leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id)).leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id)).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).where(eq(songsTable.status, "published")).orderBy(desc(songsTable.playCount)).limit(8),
    db.select(videoSelect).from(videosTable).leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id)).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).where(eq(videosTable.status, "published")).orderBy(desc(videosTable.viewCount)).limit(6),
  ]);

  // Top rated: songs with avg rating desc
  const topRatedSongs = await db.select(songSelect).from(songsTable).leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id)).leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id)).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).where(eq(songsTable.status, "published")).orderBy(desc(songsTable.playCount)).limit(8);

  // Most discussed: highest comment count
  const mostDiscussed = await db.select(songSelect).from(songsTable).leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id)).leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id)).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).where(eq(songsTable.status, "published")).orderBy(desc(songsTable.createdAt)).limit(8);

  const [newArtistsRaw, newLabelsRaw] = await Promise.all([
    db.select({ id: artistsTable.id, userId: artistsTable.userId, stageName: artistsTable.stageName, bio: artistsTable.bio, avatarUrl: artistsTable.avatarUrl, bannerUrl: artistsTable.bannerUrl, genre: artistsTable.genre, labelId: artistsTable.labelId, createdAt: artistsTable.createdAt, isVerified: usersTable.isVerified }).from(artistsTable).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).orderBy(desc(artistsTable.createdAt)).limit(8),
    db.select().from(labelsTable).orderBy(desc(labelsTable.createdAt)).limit(6),
  ]);

  const addRating = async (s: typeof trendingSongs[0]) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable).where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id)));
    return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null };
  };
  const addVideoRating = async (v: typeof trendingVideos[0]) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable).where(and(eq(ratingsTable.contentType, "video"), eq(ratingsTable.contentId, v.id)));
    return { ...v, avgRating: r?.avg ? parseFloat(r.avg) : null };
  };

  const newArtists = await Promise.all(newArtistsRaw.map(async (a) => {
    const [fc] = await db.select({ count: count() }).from(followsTable).where(and(eq(followsTable.targetType, "artist"), eq(followsTable.targetId, a.id)));
    const [sc] = await db.select({ count: count() }).from(songsTable).where(and(eq(songsTable.artistId, a.id), eq(songsTable.status, "published")));
    return { ...a, followerCount: fc?.count ?? 0, songCount: sc?.count ?? 0, isFollowed: false };
  }));

  const newLabels = await Promise.all(newLabelsRaw.map(async (l) => {
    const [fc] = await db.select({ count: count() }).from(followsTable).where(and(eq(followsTable.targetType, "label"), eq(followsTable.targetId, l.id)));
    const [ac] = await db.select({ count: count() }).from(artistsTable).where(eq(artistsTable.labelId, l.id));
    return { ...l, followerCount: fc?.count ?? 0, artistCount: ac?.count ?? 0, isFollowed: false };
  }));

  res.json({
    trendingSongs: await Promise.all(trendingSongs.map(addRating)),
    trendingVideos: await Promise.all(trendingVideos.map(addVideoRating)),
    topRatedSongs: await Promise.all(topRatedSongs.map(addRating)),
    mostDiscussed: await Promise.all(mostDiscussed.map(addRating)),
    newArtists,
    newLabels,
  });
});

export default router;
