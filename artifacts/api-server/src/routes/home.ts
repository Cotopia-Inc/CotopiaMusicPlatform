import { Router } from "express";
import { eq, desc, and, avg, sql, isNotNull, or, isNull, lte, count, gt, inArray } from "drizzle-orm";
import { db, songsTable, videosTable, artistsTable, labelsTable, albumsTable, companyPostsTable, followsTable, ratingsTable, editorPicksTable, usersTable } from "@workspace/db";
import { isFeatureRotationEnabled, rotateFeatured, FEATURED_POOL_SIZE } from "../lib/featured";
import { requireAuth } from "../lib/auth";
import { getTodayInReleaseTimezone } from "../lib/timezone";

const router = Router();

router.get("/home", requireAuth, async (_req, res): Promise<void> => {
  // Content is only publicly visible once published AND its releaseDate (if
  // any) has arrived, in US Eastern Time (see lib/timezone.ts) — not server/DB UTC.
  const today = getTodayInReleaseTimezone();
  const releasedSong = or(isNull(songsTable.releaseDate), lte(songsTable.releaseDate, today));
  const releasedVideo = or(isNull(videosTable.releaseDate), lte(videosTable.releaseDate, today));
  const songSelect = {
    id: songsTable.id, title: songsTable.title, artistId: songsTable.artistId,
    artistName: artistsTable.stageName, albumId: songsTable.albumId,
    albumName: albumsTable.title, genre: songsTable.genre, duration: songsTable.duration,
    coverUrl: songsTable.coverUrl, streamUrl: songsTable.streamUrl, isFeatured: songsTable.isFeatured,
    playCount: songsTable.playCount, status: songsTable.status, releaseType: songsTable.releaseType,
    createdAt: songsTable.createdAt, artistIsVerified: usersTable.isVerified,
    artistUserRole: usersTable.role,
  };

  const videoSelect = {
    id: videosTable.id, title: videosTable.title, artistId: videosTable.artistId,
    artistName: artistsTable.stageName, genre: videosTable.genre, duration: videosTable.duration,
    thumbnailUrl: videosTable.thumbnailUrl, videoUrl: videosTable.videoUrl, isFeatured: videosTable.isFeatured,
    viewCount: videosTable.viewCount, status: videosTable.status, createdAt: videosTable.createdAt,
    artistIsVerified: usersTable.isVerified,
      artistUserRole: usersTable.role,
  };

  const [featuredSongs, featuredVideos, trendingSongs, newReleases] = await Promise.all([
    db.select(songSelect).from(songsTable).leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id)).leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id)).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).where(and(eq(songsTable.isFeatured, true), eq(songsTable.status, "published"), isNotNull(songsTable.coverUrl), releasedSong)).orderBy(desc(songsTable.createdAt)).limit(FEATURED_POOL_SIZE),
    db.select(videoSelect).from(videosTable).leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id)).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).where(and(eq(videosTable.isFeatured, true), eq(videosTable.status, "published"), isNotNull(videosTable.thumbnailUrl), releasedVideo)).orderBy(desc(videosTable.createdAt)).limit(FEATURED_POOL_SIZE),
    db.select(songSelect).from(songsTable).leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id)).leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id)).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).where(and(eq(songsTable.status, "published"), isNotNull(songsTable.coverUrl), releasedSong)).orderBy(desc(songsTable.playCount)).limit(10),
    db.select(songSelect).from(songsTable).leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id)).leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id)).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).where(and(eq(songsTable.status, "published"), isNotNull(songsTable.coverUrl), releasedSong)).orderBy(desc(songsTable.createdAt)).limit(8),
  ]);

  const rotation = await isFeatureRotationEnabled();
  const rotatedFeaturedSongs = rotateFeatured(featuredSongs, 6, rotation);
  const rotatedFeaturedVideos = rotateFeatured(featuredVideos, 4, rotation);

  const [rawArtistsAll, rawLabelsAll, announcements] = await Promise.all([
    db.select({ id: artistsTable.id, userId: artistsTable.userId, stageName: artistsTable.stageName, bio: artistsTable.bio, avatarUrl: sql<string | null>`COALESCE(${artistsTable.avatarUrl}, ${usersTable.avatarUrl})`, bannerUrl: sql<string | null>`COALESCE(${artistsTable.bannerUrl}, ${usersTable.bannerUrl})`, genre: artistsTable.genre, labelId: artistsTable.labelId, createdAt: artistsTable.createdAt, isVerified: usersTable.isVerified }).from(artistsTable).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).orderBy(desc(artistsTable.createdAt)).limit(20),
    db.select({ id: labelsTable.id, userId: labelsTable.userId, name: labelsTable.name, bio: labelsTable.bio, logoUrl: sql<string | null>`COALESCE(${labelsTable.logoUrl}, ${usersTable.avatarUrl})`, bannerUrl: sql<string | null>`COALESCE(${labelsTable.bannerUrl}, ${usersTable.bannerUrl})`, createdAt: labelsTable.createdAt, isVerified: usersTable.isVerified }).from(labelsTable).innerJoin(usersTable, eq(labelsTable.userId, usersTable.id)).orderBy(desc(labelsTable.createdAt)).limit(20),
    db.select().from(companyPostsTable).orderBy(desc(companyPostsTable.isPinned), desc(companyPostsTable.createdAt)).limit(3),
  ]);
  // Deduplicate by userId before filtering — guard against multiple records per user from repeated seed runs.
  const seenArtistUsers = new Set<number>();
  const rawArtists = rawArtistsAll
    .filter(a => { if (!a.userId) return true; if (seenArtistUsers.has(a.userId)) return false; seenArtistUsers.add(a.userId); return true; })
    .filter(a => a.avatarUrl).slice(0, 6);

  const seenLabelUsers = new Set<number>();
  const rawLabels = rawLabelsAll
    .filter(l => { if (!l.userId) return true; if (seenLabelUsers.has(l.userId)) return false; seenLabelUsers.add(l.userId); return true; })
    .filter(l => l.logoUrl).slice(0, 4);

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
    const [sc] = await db.select({ count: count() }).from(songsTable).where(and(eq(songsTable.artistId, a.id), eq(songsTable.status, "published"), releasedSong));
    return { ...a, followerCount: fc?.count ?? 0, songCount: sc?.count ?? 0, isFollowed: false };
  }));

  const featuredLabels = await Promise.all(rawLabels.map(async (l) => {
    const [fc] = await db.select({ count: count() }).from(followsTable).where(and(eq(followsTable.targetType, "label"), eq(followsTable.targetId, l.id)));
    const [ac] = await db.select({ count: count() }).from(artistsTable).where(eq(artistsTable.labelId, l.id));
    return { ...l, followerCount: fc?.count ?? 0, artistCount: ac?.count ?? 0, isFollowed: false };
  }));

  const rawPicks = await db
    .select({
      id: editorPicksTable.id,
      contentType: editorPicksTable.contentType,
      contentId: editorPicksTable.contentId,
      editorId: editorPicksTable.editorId,
      editorUsername: usersTable.username,
      note: editorPicksTable.note,
      displayOrder: editorPicksTable.displayOrder,
      createdAt: editorPicksTable.createdAt,
    })
    .from(editorPicksTable)
    .leftJoin(usersTable, eq(editorPicksTable.editorId, usersTable.id))
    .orderBy(editorPicksTable.displayOrder, desc(editorPicksTable.createdAt))
    .limit(12);

  const editorPicks = await Promise.all(rawPicks.map(async (p) => {
    let song = null, video = null, artist = null;
    if (p.contentType === "song") {
      const rows = await db.select({
        id: songsTable.id, title: songsTable.title, artistId: songsTable.artistId,
        artistName: artistsTable.stageName, albumId: songsTable.albumId,
        albumName: albumsTable.title, genre: songsTable.genre, duration: songsTable.duration,
        coverUrl: songsTable.coverUrl, streamUrl: songsTable.streamUrl,
        playCount: songsTable.playCount, status: songsTable.status,
        isFeatured: songsTable.isFeatured, createdAt: songsTable.createdAt,
        artistIsVerified: usersTable.isVerified,
      artistUserRole: usersTable.role,
      }).from(songsTable)
        .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
        .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
        .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
        .where(and(eq(songsTable.id, p.contentId), eq(songsTable.status, "published"), releasedSong)).limit(1);
      song = (rows[0] && rows[0].coverUrl) ? rows[0] : null;
    } else if (p.contentType === "video") {
      const rows = await db.select({
        id: videosTable.id, title: videosTable.title, artistId: videosTable.artistId,
        artistName: artistsTable.stageName, genre: videosTable.genre, duration: videosTable.duration,
        thumbnailUrl: videosTable.thumbnailUrl, videoUrl: videosTable.videoUrl,
        viewCount: videosTable.viewCount, status: videosTable.status,
        isFeatured: videosTable.isFeatured, createdAt: videosTable.createdAt,
        artistIsVerified: usersTable.isVerified,
      artistUserRole: usersTable.role,
      }).from(videosTable)
        .leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
        .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
        .where(and(eq(videosTable.id, p.contentId), eq(videosTable.status, "published"), releasedVideo)).limit(1);
      video = (rows[0] && rows[0].thumbnailUrl) ? rows[0] : null;
    } else if (p.contentType === "artist") {
      const rows = await db.select({
        id: artistsTable.id, userId: artistsTable.userId, stageName: artistsTable.stageName,
        bio: artistsTable.bio, avatarUrl: sql<string | null>`COALESCE(${artistsTable.avatarUrl}, ${usersTable.avatarUrl})`, bannerUrl: sql<string | null>`COALESCE(${artistsTable.bannerUrl}, ${usersTable.bannerUrl})`,
        genre: artistsTable.genre, labelId: artistsTable.labelId, createdAt: artistsTable.createdAt,
        isVerified: usersTable.isVerified,
      }).from(artistsTable)
        .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
        .where(eq(artistsTable.id, p.contentId)).limit(1);
      const a = rows[0] ?? null;
      artist = (a && a.avatarUrl) ? a : null;
    }
    return { ...p, song, video, artist };
  }));

  // Top-rated songs (top 3) for home showcase
  const byRatingDesc = (
    a: { avgRating: unknown; ratingCount: unknown },
    b: { avgRating: unknown; ratingCount: unknown },
  ) => {
    const ra = typeof a.avgRating === "number" && !isNaN(a.avgRating) ? a.avgRating : 0;
    const rb = typeof b.avgRating === "number" && !isNaN(b.avgRating) ? b.avgRating : 0;
    if (rb !== ra) return rb - ra;
    const ca = typeof a.ratingCount === "number" ? a.ratingCount : 0;
    const cb = typeof b.ratingCount === "number" ? b.ratingCount : 0;
    return cb - ca;
  };

  const [songRatingAgg, videoRatingAgg] = await Promise.all([
    db.select({ contentId: ratingsTable.contentId, avgRating: avg(ratingsTable.rating), ratingCount: count() })
      .from(ratingsTable).where(eq(ratingsTable.contentType, "song"))
      .groupBy(ratingsTable.contentId).having(gt(count(), 0))
      .orderBy(desc(avg(ratingsTable.rating)), desc(count())).limit(15),
    db.select({ contentId: ratingsTable.contentId, avgRating: avg(ratingsTable.rating), ratingCount: count() })
      .from(ratingsTable).where(eq(ratingsTable.contentType, "video"))
      .groupBy(ratingsTable.contentId).having(gt(count(), 0))
      .orderBy(desc(avg(ratingsTable.rating)), desc(count())).limit(10),
  ]);

  let topRatedSongs: Array<Record<string, unknown>> = [];
  if (songRatingAgg.length > 0) {
    const ratedIds = songRatingAgg.map(r => r.contentId);
    const ratingMap = new Map(songRatingAgg.map(r => [r.contentId, {
      avgRating: r.avgRating ? parseFloat(r.avgRating) : null,
      ratingCount: r.ratingCount,
    }]));
    const rows = await db.select(songSelect).from(songsTable)
      .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
      .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
      .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
      .where(and(eq(songsTable.status, "published"), inArray(songsTable.id, ratedIds), releasedSong, isNotNull(songsTable.coverUrl)));
    topRatedSongs = rows
      .filter(s => ratingMap.has(s.id))
      .map(s => ({ ...s, avgRating: ratingMap.get(s.id)!.avgRating, ratingCount: ratingMap.get(s.id)!.ratingCount }))
      .sort(byRatingDesc).slice(0, 3);
  }

  let topRatedVideos: Array<Record<string, unknown>> = [];
  if (videoRatingAgg.length > 0) {
    const ratedIds = videoRatingAgg.map(r => r.contentId);
    const ratingMap = new Map(videoRatingAgg.map(r => [r.contentId, {
      avgRating: r.avgRating ? parseFloat(r.avgRating) : null,
      ratingCount: r.ratingCount,
    }]));
    const rows = await db.select(videoSelect).from(videosTable)
      .leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
      .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
      .where(and(eq(videosTable.status, "published"), inArray(videosTable.id, ratedIds), releasedVideo, isNotNull(videosTable.thumbnailUrl)));
    topRatedVideos = rows
      .filter(v => ratingMap.has(v.id))
      .map(v => ({ ...v, avgRating: ratingMap.get(v.id)!.avgRating, ratingCount: ratingMap.get(v.id)!.ratingCount }))
      .sort(byRatingDesc).slice(0, 3);
  }

  res.json({
    topRatedSongs,
    topRatedVideos,
    featuredSongs: await Promise.all(rotatedFeaturedSongs.map(addRatingToSong)),
    featuredVideos: await Promise.all(rotatedFeaturedVideos.map(addRatingToVideo)),
    featuredArtists,
    featuredLabels,
    trendingSongs: await Promise.all(trendingSongs.map(addRatingToSong)),
    newReleases: await Promise.all(newReleases.map(addRatingToSong)),
    announcements,
    editorPicks: editorPicks.filter(p => p.song || p.video || p.artist),
  });
});

export default router;
