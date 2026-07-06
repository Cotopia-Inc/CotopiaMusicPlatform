import { Router } from "express";
import { eq, desc, sql, ilike, and, count, avg, or, isNull, lte } from "drizzle-orm";
import {
  db, songsTable, artistsTable, albumsTable, usersTable,
  commentsTable, ratingsTable, favoritesTable, historyTable,
} from "@workspace/db";
import {
  ListSongsQueryParams, CreateSongBody, UpdateSongBody,
  GetSongParams, UpdateSongParams, DeleteSongParams,
  RecordSongPlayParams, GetSongCommentsParams, CreateSongCommentParams,
  CreateSongCommentBody, RateSongParams, RateSongBody,
} from "@workspace/api-zod";
import { isFeatureRotationEnabled, rotateFeatured, FEATURED_POOL_SIZE } from "../lib/featured";
import { isFutureRelease } from "../lib/publisher";
import { requireAuth, optionalAuth, type AuthRequest } from "../lib/auth";
import { getPrimaryBadgesForUsers } from "./badges";

const router = Router();

// Helpers
async function getSongWithArtist(id: number, userId?: number) {
  const [row] = await db
    .select({
      id: songsTable.id,
      title: songsTable.title,
      artistId: songsTable.artistId,
      artistUserId: usersTable.id,
      artistName: artistsTable.stageName,
      artistUserRole: usersTable.role,
      artistIsVerified: usersTable.isVerified,
      albumId: songsTable.albumId,
      albumName: albumsTable.title,
      genre: songsTable.genre,
      duration: songsTable.duration,
      coverUrl: songsTable.coverUrl,
      streamUrl: songsTable.streamUrl,
      playCount: songsTable.playCount,
      isFeatured: songsTable.isFeatured,
      status: songsTable.status,
      releaseDate: songsTable.releaseDate,
      createdAt: songsTable.createdAt,
      lyrics: songsTable.lyrics,
      credits: songsTable.credits,
    })
    .from(songsTable)
    .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
    .where(eq(songsTable.id, id))
    .limit(1);

  if (!row) return null;

  const ratingRows = await db
    .select({ avg: avg(ratingsTable.rating), count: count() })
    .from(ratingsTable)
    .where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, id)));

  let userRating: number | null = null;
  let isFavorited = false;

  if (userId) {
    const [ur] = await db.select().from(ratingsTable)
      .where(and(eq(ratingsTable.userId, userId), eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, id)));
    userRating = ur?.rating ?? null;

    const [fav] = await db.select().from(favoritesTable)
      .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.contentType, "song"), eq(favoritesTable.contentId, id)));
    isFavorited = !!fav;
  }

  const [commentCount] = await db.select({ count: count() }).from(commentsTable)
    .where(and(eq(commentsTable.contentType, "song"), eq(commentsTable.contentId, id)));

  return {
    ...row,
    avgRating: ratingRows[0]?.avg ? parseFloat(ratingRows[0].avg) : null,
    ratingCount: ratingRows[0]?.count ?? 0,
    commentCount: commentCount?.count ?? 0,
    userRating,
    isFavorited,
  };
}

router.get("/songs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = ListSongsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { q, artistId, genre, limit = 20, offset = 0 } = params.data;

  const releasedSong = or(isNull(songsTable.releaseDate), lte(songsTable.releaseDate, sql`CURRENT_DATE`));
  const conditions = [eq(songsTable.status, "published"), releasedSong!];
  if (q) conditions.push(ilike(songsTable.title, `%${q}%`));
  if (artistId) conditions.push(eq(songsTable.artistId, artistId));
  if (genre) conditions.push(eq(songsTable.genre, genre));

  const items = await db
    .select({
      id: songsTable.id,
      title: songsTable.title,
      artistId: songsTable.artistId,
      artistName: artistsTable.stageName,
      artistUserRole: usersTable.role,
      artistIsVerified: usersTable.isVerified,
      albumId: songsTable.albumId,
      albumName: albumsTable.title,
      genre: songsTable.genre,
      duration: songsTable.duration,
      coverUrl: songsTable.coverUrl,
      streamUrl: songsTable.streamUrl,
      playCount: songsTable.playCount,
      isFeatured: songsTable.isFeatured,
      status: songsTable.status,
      createdAt: songsTable.createdAt,
    })
    .from(songsTable)
    .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
    .where(and(...conditions))
    .orderBy(desc(songsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db.select({ count: count() }).from(songsTable).where(and(...conditions));

  const itemsWithRating = await Promise.all(items.map(async (s) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable)
      .where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id)));
    return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json({ items: itemsWithRating, total: totalRow?.count ?? 0 });
});

router.post("/songs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [artist] = await db.select().from(artistsTable).where(eq(artistsTable.userId, req.user!.userId)).limit(1);
  if (!artist) {
    res.status(403).json({ error: "Artist profile required" });
    return;
  }

  const [song] = await db.insert(songsTable).values({
    ...parsed.data,
    artistId: artist.id,
  }).returning();

  const result = await getSongWithArtist(song.id, req.user?.userId);
  res.status(201).json(result);
});

router.get("/songs/featured", requireAuth, async (_req, res): Promise<void> => {
  const songs = await db
    .select({
      id: songsTable.id,
      title: songsTable.title,
      artistId: songsTable.artistId,
      artistName: artistsTable.stageName,
      artistUserRole: usersTable.role,
      artistIsVerified: usersTable.isVerified,
      albumId: songsTable.albumId,
      albumName: albumsTable.title,
      genre: songsTable.genre,
      duration: songsTable.duration,
      coverUrl: songsTable.coverUrl,
      streamUrl: songsTable.streamUrl,
      playCount: songsTable.playCount,
      status: songsTable.status,
      createdAt: songsTable.createdAt,
    })
    .from(songsTable)
    .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
    .where(and(eq(songsTable.isFeatured, true), eq(songsTable.status, "published"), or(isNull(songsTable.releaseDate), lte(songsTable.releaseDate, sql`CURRENT_DATE`))))
    .orderBy(desc(songsTable.createdAt))
    .limit(FEATURED_POOL_SIZE);

  const rotation = await isFeatureRotationEnabled();
  const rotated = rotateFeatured(songs, 8, rotation);

  const withRatings = await Promise.all(rotated.map(async (s) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable)
      .where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id)));
    return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json(withRatings);
});

router.get("/songs/trending", requireAuth, async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "10"), 10);
  const songs = await db
    .select({
      id: songsTable.id,
      title: songsTable.title,
      artistId: songsTable.artistId,
      artistName: artistsTable.stageName,
      artistUserRole: usersTable.role,
      artistIsVerified: usersTable.isVerified,
      albumId: songsTable.albumId,
      albumName: albumsTable.title,
      genre: songsTable.genre,
      duration: songsTable.duration,
      coverUrl: songsTable.coverUrl,
      streamUrl: songsTable.streamUrl,
      playCount: songsTable.playCount,
      status: songsTable.status,
      createdAt: songsTable.createdAt,
    })
    .from(songsTable)
    .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
    .where(and(eq(songsTable.status, "published"), or(isNull(songsTable.releaseDate), lte(songsTable.releaseDate, sql`CURRENT_DATE`))))
    .orderBy(desc(songsTable.playCount))
    .limit(limit);

  const withRatings = await Promise.all(songs.map(async (s) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable)
      .where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id)));
    return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json(withRatings);
});

router.get("/songs/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const song = await getSongWithArtist(params.data.id, req.user?.userId);
  if (!song) {
    res.status(404).json({ error: "Song not found" });
    return;
  }

  // Enforce releaseDate/status even on direct-by-id access: only the owning
  // artist or staff may view unpublished or not-yet-released content.
  const today = new Date().toISOString().slice(0, 10);
  const isReleased = song.status === "published" && (!song.releaseDate || song.releaseDate <= today);
  if (!isReleased) {
    const isStaff = ["admin", "master_admin", "editor", "moderator"].includes(req.user!.role);
    const isOwner = song.artistUserId === req.user!.userId;
    if (!isStaff && !isOwner) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
  }

  res.json(song);
});

router.patch("/songs/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(songsTable).where(eq(songsTable.id, params.data.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Song not found" });
    return;
  }

  const isAdmin = ["admin", "master_admin", "editor"].includes(req.user!.role);
  if (!isAdmin) {
    const [artist] = await db.select().from(artistsTable).where(eq(artistsTable.userId, req.user!.userId)).limit(1);
    if (!artist || existing.artistId !== artist.id) {
      res.status(403).json({ error: "You don't have permission to modify this content." });
      return;
    }
  }

  // Guard: never allow a direct status change to "published" to bypass a
  // scheduled release date — the scheduled release job will publish it
  // automatically once the date arrives.
  if (parsed.data.status === "published" && isFutureRelease(existing.releaseDate)) {
    res.status(409).json({ error: `This song is scheduled to release on ${existing.releaseDate} and cannot be published early.` });
    return;
  }

  await db.update(songsTable).set(parsed.data).where(eq(songsTable.id, params.data.id));
  const result = await getSongWithArtist(params.data.id, req.user?.userId);
  res.json(result);
});

router.delete("/songs/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(songsTable).where(eq(songsTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Song not found" }); return; }
  const isAdmin = req.user!.role === "admin" || req.user!.role === "master_admin";
  if (!isAdmin) {
    const [artist] = await db.select().from(artistsTable).where(eq(artistsTable.userId, req.user!.userId)).limit(1);
    if (!artist || existing.artistId !== artist.id) { res.status(403).json({ error: "You don't have permission to modify this content." }); return; }
  }
  await db.delete(songsTable).where(eq(songsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/songs/:id/play", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = RecordSongPlayParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.update(songsTable).set({ playCount: sql`${songsTable.playCount} + 1` }).where(eq(songsTable.id, params.data.id));

  if (req.user) {
    await db.insert(historyTable).values({ userId: req.user.userId, contentType: "song", contentId: params.data.id });
  }
  res.json({ ok: true });
});

router.get("/songs/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const params = GetSongCommentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const topLevel = await db
    .select({
      id: commentsTable.id,
      userId: commentsTable.userId,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      content: commentsTable.content,
      parentId: commentsTable.parentId,
      createdAt: commentsTable.createdAt,
    })
    .from(commentsTable)
    .leftJoin(usersTable, eq(commentsTable.userId, usersTable.id))
    .where(and(
      eq(commentsTable.contentType, "song"),
      eq(commentsTable.contentId, params.data.id),
      sql`${commentsTable.parentId} IS NULL`
    ))
    .orderBy(desc(commentsTable.createdAt));

  const withReplies = await Promise.all(topLevel.map(async (c) => {
    const replies = await db
      .select({
        id: commentsTable.id,
        userId: commentsTable.userId,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
        content: commentsTable.content,
        parentId: commentsTable.parentId,
        createdAt: commentsTable.createdAt,
      })
      .from(commentsTable)
      .leftJoin(usersTable, eq(commentsTable.userId, usersTable.id))
      .where(eq(commentsTable.parentId, c.id));
    return { ...c, replies };
  }));

  const allUserIds = Array.from(new Set([
    ...topLevel.map(c => c.userId),
    ...withReplies.flatMap(c => c.replies.map(r => r.userId)),
  ].filter((id): id is number => id != null)));
  const badgeMap = await getPrimaryBadgesForUsers(allUserIds);

  res.json(withReplies.map(c => ({
    ...c,
    primaryBadge: c.userId != null ? (badgeMap.get(c.userId) ?? null) : null,
    replies: c.replies.map(r => ({
      ...r,
      replies: [],
      primaryBadge: r.userId != null ? (badgeMap.get(r.userId) ?? null) : null,
    })),
  })));
});

router.post("/songs/:id/comments", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = CreateSongCommentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateSongCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [comment] = await db.insert(commentsTable).values({
    userId: req.user!.userId,
    contentType: "song",
    contentId: params.data.id,
    content: parsed.data.content,
    parentId: parsed.data.parentId ?? null,
  }).returning();

  const [user] = await db.select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
    .from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);

  const badgeMap = await getPrimaryBadgesForUsers([req.user!.userId]);
  const primaryBadge = badgeMap.get(req.user!.userId) ?? null;

  res.status(201).json({ ...comment, username: user?.username, avatarUrl: user?.avatarUrl, primaryBadge, replies: [] });
});

router.post("/songs/:id/rate", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = RateSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = RateSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.rating === 0) {
    await db.delete(ratingsTable).where(and(
      eq(ratingsTable.userId, req.user!.userId),
      eq(ratingsTable.contentType, "song"),
      eq(ratingsTable.contentId, params.data.id),
    ));
  } else {
    await db.insert(ratingsTable).values({
      userId: req.user!.userId,
      contentType: "song",
      contentId: params.data.id,
      rating: parsed.data.rating,
    }).onConflictDoUpdate({
      target: [ratingsTable.userId, ratingsTable.contentType, ratingsTable.contentId],
      set: { rating: parsed.data.rating },
    });
  }

  const [result] = await db
    .select({ avg: avg(ratingsTable.rating), count: count() })
    .from(ratingsTable)
    .where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, params.data.id)));

  res.json({ avgRating: parseFloat(result?.avg ?? "0"), ratingCount: result?.count ?? 0 });
});

export default router;
