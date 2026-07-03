import { Router } from "express";
import { eq, desc, and, avg, count, sql, or, isNull, lte, inArray, gt, isNotNull } from "drizzle-orm";
import { db, songsTable, videosTable, artistsTable, labelsTable, albumsTable, ratingsTable, commentsTable, followsTable, usersTable, appSettingsTable } from "@workspace/db";
import { isFeatureRotationEnabled, rotateFeatured, FEATURED_POOL_SIZE } from "../lib/featured";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/discover", requireAuth, async (_req, res): Promise<void> => {
  const releasedSong = or(isNull(songsTable.releaseDate), lte(songsTable.releaseDate, sql`CURRENT_DATE`));
  const releasedVideo = or(isNull(videosTable.releaseDate), lte(videosTable.releaseDate, sql`CURRENT_DATE`));

  const songSelect = {
    id: songsTable.id, title: songsTable.title, artistId: songsTable.artistId,
    artistName: artistsTable.stageName, albumId: songsTable.albumId,
    albumName: albumsTable.title, genre: songsTable.genre, duration: songsTable.duration,
    coverUrl: songsTable.coverUrl, streamUrl: songsTable.streamUrl,
    playCount: songsTable.playCount, status: songsTable.status, createdAt: songsTable.createdAt,
    artistIsVerified: usersTable.isVerified,
    artistUserRole: usersTable.role,
  };

  const videoSelect = {
    id: videosTable.id, title: videosTable.title, artistId: videosTable.artistId,
    artistName: artistsTable.stageName, genre: videosTable.genre, duration: videosTable.duration,
    thumbnailUrl: videosTable.thumbnailUrl, videoUrl: videosTable.videoUrl,
    viewCount: videosTable.viewCount, status: videosTable.status, createdAt: videosTable.createdAt,
    artistIsVerified: usersTable.isVerified,
    artistUserRole: usersTable.role,
  };

  const [trendingSongs, trendingVideos, featuredSongs, featuredVideos, newSongsRaw, newVideosRaw] = await Promise.all([
    db.select(songSelect).from(songsTable).leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id)).leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id)).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).where(and(eq(songsTable.status, "published"), releasedSong!, isNotNull(songsTable.coverUrl))).orderBy(desc(songsTable.playCount)).limit(8),
    db.select(videoSelect).from(videosTable).leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id)).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).where(and(eq(videosTable.status, "published"), releasedVideo!, isNotNull(videosTable.thumbnailUrl))).orderBy(desc(videosTable.viewCount)).limit(6),
    db.select(songSelect).from(songsTable).leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id)).leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id)).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).where(and(eq(songsTable.isFeatured, true), eq(songsTable.status, "published"), releasedSong!, isNotNull(songsTable.coverUrl))).orderBy(desc(songsTable.createdAt)).limit(FEATURED_POOL_SIZE),
    db.select(videoSelect).from(videosTable).leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id)).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).where(and(eq(videosTable.isFeatured, true), eq(videosTable.status, "published"), releasedVideo!, isNotNull(videosTable.thumbnailUrl))).orderBy(desc(videosTable.createdAt)).limit(FEATURED_POOL_SIZE),
    db.select(songSelect).from(songsTable).leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id)).leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id)).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).where(and(eq(songsTable.status, "published"), releasedSong!, isNotNull(songsTable.coverUrl))).orderBy(desc(songsTable.createdAt)).limit(8),
    db.select(videoSelect).from(videosTable).leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id)).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).where(and(eq(videosTable.status, "published"), releasedVideo!, isNotNull(videosTable.thumbnailUrl))).orderBy(desc(videosTable.createdAt)).limit(6),
  ]);

  const rotation = await isFeatureRotationEnabled();
  const rotatedFeaturedSongs = rotateFeatured(featuredSongs, 10, rotation);
  const rotatedFeaturedVideos = rotateFeatured(featuredVideos, 6, rotation);

  const addRating = async (s: typeof trendingSongs[0]) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable).where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id)));
    return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null };
  };
  const addVideoRating = async (v: typeof trendingVideos[0]) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable).where(and(eq(ratingsTable.contentType, "video"), eq(ratingsTable.contentId, v.id)));
    return { ...v, avgRating: r?.avg ? parseFloat(r.avg) : null };
  };

  // App settings for top-rated control
  const [appSettings] = await db.select({
    showTopRated: appSettingsTable.showTopRated,
    topRatedMinRatings: appSettingsTable.topRatedMinRatings,
  }).from(appSettingsTable).limit(1);
  const showTopRated = appSettings?.showTopRated ?? true;
  const minRatings = appSettings?.topRatedMinRatings ?? 1;

  // Top rated: aggregate avg from ratings table, then fetch song rows
  // This correctly sorts by real avg rating (not playCount)
  const ratingAggRows = await db.select({
    contentId: ratingsTable.contentId,
    avgRating: avg(ratingsTable.rating),
    ratingCount: count(),
  }).from(ratingsTable)
    .where(eq(ratingsTable.contentType, "song"))
    .groupBy(ratingsTable.contentId)
    .having(gt(count(), minRatings - 1))
    .orderBy(desc(avg(ratingsTable.rating)), desc(count()))
    .limit(10);

  let topRatedSongs: Array<Record<string, unknown>> = [];
  if (ratingAggRows.length > 0) {
    const ratedIds = ratingAggRows.map(r => r.contentId);
    const ratingMap = new Map(ratingAggRows.map(r => [r.contentId, {
      avgRating: r.avgRating ? parseFloat(r.avgRating) : null,
      ratingCount: r.ratingCount,
    }]));
    const ratedSongRows = await db.select(songSelect).from(songsTable)
      .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
      .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
      .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
      .where(and(eq(songsTable.status, "published"), inArray(songsTable.id, ratedIds), releasedSong!, isNotNull(songsTable.coverUrl)));
    topRatedSongs = ratedSongRows
      .filter(s => ratingMap.has(s.id))
      .map(s => ({ ...s, avgRating: ratingMap.get(s.id)!.avgRating, ratingCount: ratingMap.get(s.id)!.ratingCount }))
      .sort((a, b) => ((b.avgRating as number) ?? 0) - ((a.avgRating as number) ?? 0));
  }

  // Top rated videos — same two-step pattern
  const videoRatingAggRows = await db.select({
    contentId: ratingsTable.contentId,
    avgRating: avg(ratingsTable.rating),
    ratingCount: count(),
  }).from(ratingsTable)
    .where(eq(ratingsTable.contentType, "video"))
    .groupBy(ratingsTable.contentId)
    .having(gt(count(), minRatings - 1))
    .orderBy(desc(avg(ratingsTable.rating)), desc(count()))
    .limit(8);

  let topRatedVideos: Array<Record<string, unknown>> = [];
  if (videoRatingAggRows.length > 0) {
    const ratedVideoIds = videoRatingAggRows.map(r => r.contentId);
    const videoRatingMap = new Map(videoRatingAggRows.map(r => [r.contentId, {
      avgRating: r.avgRating ? parseFloat(r.avgRating) : null,
      ratingCount: r.ratingCount,
    }]));
    const ratedVideoRows = await db.select(videoSelect).from(videosTable)
      .leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
      .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
      .where(and(eq(videosTable.status, "published"), inArray(videosTable.id, ratedVideoIds), releasedVideo!, isNotNull(videosTable.thumbnailUrl)));
    topRatedVideos = ratedVideoRows
      .filter(v => videoRatingMap.has(v.id))
      .map(v => ({ ...v, avgRating: videoRatingMap.get(v.id)!.avgRating, ratingCount: videoRatingMap.get(v.id)!.ratingCount }))
      .sort((a, b) => ((b.avgRating as number) ?? 0) - ((a.avgRating as number) ?? 0));
  }

  // Most discussed: songs sorted by actual comment count (not createdAt)
  const commentAggRows = await db.select({
    contentId: commentsTable.contentId,
    commentCount: count(),
  }).from(commentsTable)
    .where(eq(commentsTable.contentType, "song"))
    .groupBy(commentsTable.contentId)
    .having(gt(count(), 0))
    .orderBy(desc(count()))
    .limit(8);

  let mostDiscussed: Array<Record<string, unknown>> = [];
  if (commentAggRows.length > 0) {
    const commentIds = commentAggRows.map(r => r.contentId);
    const commentMap = new Map(commentAggRows.map(r => [r.contentId, r.commentCount]));
    const discussedRows = await db.select(songSelect).from(songsTable)
      .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
      .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
      .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
      .where(and(eq(songsTable.status, "published"), inArray(songsTable.id, commentIds), releasedSong!, isNotNull(songsTable.coverUrl)));
    const sorted = discussedRows
      .filter(s => commentMap.has(s.id))
      .sort((a, b) => (commentMap.get(b.id) ?? 0) - (commentMap.get(a.id) ?? 0));
    mostDiscussed = await Promise.all(sorted.map(async (s) => {
      const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable)
        .where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id)));
      return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null, commentCount: commentMap.get(s.id) ?? 0 };
    }));
  }

  const [newArtistsAll, newLabelsAll] = await Promise.all([
    db.select({ id: artistsTable.id, userId: artistsTable.userId, stageName: artistsTable.stageName, bio: artistsTable.bio, avatarUrl: sql<string | null>`COALESCE(${artistsTable.avatarUrl}, ${usersTable.avatarUrl})`, bannerUrl: sql<string | null>`COALESCE(${artistsTable.bannerUrl}, ${usersTable.bannerUrl})`, genre: artistsTable.genre, labelId: artistsTable.labelId, createdAt: artistsTable.createdAt, isVerified: usersTable.isVerified }).from(artistsTable).leftJoin(usersTable, eq(artistsTable.userId, usersTable.id)).orderBy(desc(artistsTable.createdAt)).limit(30),
    db.select({ id: labelsTable.id, userId: labelsTable.userId, name: labelsTable.name, bio: labelsTable.bio, logoUrl: sql<string | null>`COALESCE(${labelsTable.logoUrl}, ${usersTable.avatarUrl})`, bannerUrl: sql<string | null>`COALESCE(${labelsTable.bannerUrl}, ${usersTable.bannerUrl})`, createdAt: labelsTable.createdAt, isVerified: usersTable.isVerified }).from(labelsTable).innerJoin(usersTable, eq(labelsTable.userId, usersTable.id)).orderBy(desc(labelsTable.createdAt)).limit(20),
  ]);

  // Deduplicate by userId — guard against multiple records per user from repeated seed runs.
  const seenDiscoverArtists = new Set<number>();
  const newArtistsRaw = newArtistsAll
    .filter(a => { if (!a.userId) return true; if (seenDiscoverArtists.has(a.userId)) return false; seenDiscoverArtists.add(a.userId); return true; })
    .filter(a => a.avatarUrl).slice(0, 8);

  const seenDiscoverLabels = new Set<number>();
  const newLabelsRaw = newLabelsAll
    .filter(l => { if (!l.userId) return true; if (seenDiscoverLabels.has(l.userId)) return false; seenDiscoverLabels.add(l.userId); return true; })
    .filter(l => l.logoUrl).slice(0, 6);

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
    featuredSongs: await Promise.all(rotatedFeaturedSongs.map(addRating)),
    featuredVideos: await Promise.all(rotatedFeaturedVideos.map(addVideoRating)),
    trendingSongs: await Promise.all(trendingSongs.map(addRating)),
    trendingVideos: await Promise.all(trendingVideos.map(addVideoRating)),
    topRatedSongs: showTopRated ? topRatedSongs : [],
    topRatedVideos: showTopRated ? topRatedVideos : [],
    mostDiscussed,
    newSongs: await Promise.all(newSongsRaw.map(addRating)),
    newVideos: await Promise.all(newVideosRaw.map(addVideoRating)),
    newArtists,
    newLabels,
    showTopRated,
    topRatedMinRatings: minRatings,
  });
});

export default router;
