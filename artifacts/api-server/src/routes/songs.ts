import { Router } from "express";
import { eq, desc, sql, ilike, and, count, avg } from "drizzle-orm";
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
import { requireAuth, optionalAuth, type AuthRequest } from "../lib/auth";

const router = Router();

// Helpers
async function getSongWithArtist(id: number, userId?: number) {
  const [row] = await db
    .select({
      id: songsTable.id,
      title: songsTable.title,
      artistId: songsTable.artistId,
      artistName: artistsTable.stageName,
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
    commentCount: commentCount?.count ?? 0,
    userRating,
    isFavorited,
  };
}

router.get("/songs", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = ListSongsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { q, artistId, genre, limit = 20, offset = 0 } = params.data;

  const conditions = [eq(songsTable.status, "published")];
  if (q) conditions.push(ilike(songsTable.title, `%${q}%`));
  if (artistId) conditions.push(eq(songsTable.artistId, artistId));
  if (genre) conditions.push(eq(songsTable.genre, genre));

  const items = await db
    .select({
      id: songsTable.id,
      title: songsTable.title,
      artistId: songsTable.artistId,
      artistName: artistsTable.stageName,
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

router.get("/songs/featured", async (_req, res): Promise<void> => {
  const songs = await db
    .select({
      id: songsTable.id,
      title: songsTable.title,
      artistId: songsTable.artistId,
      artistName: artistsTable.stageName,
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
    .where(and(eq(songsTable.isFeatured, true), eq(songsTable.status, "published")))
    .orderBy(desc(songsTable.createdAt))
    .limit(8);

  const withRatings = await Promise.all(songs.map(async (s) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable)
      .where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id)));
    return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json(withRatings);
});

router.get("/songs/trending", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "10"), 10);
  const songs = await db
    .select({
      id: songsTable.id,
      title: songsTable.title,
      artistId: songsTable.artistId,
      artistName: artistsTable.stageName,
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
    .where(eq(songsTable.status, "published"))
    .orderBy(desc(songsTable.playCount))
    .limit(limit);

  const withRatings = await Promise.all(songs.map(async (s) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable)
      .where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id)));
    return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json(withRatings);
});

router.get("/songs/:id", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
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

  const isAdmin = req.user!.role === "admin" || req.user!.role === "master_admin";
  if (!isAdmin) {
    const [artist] = await db.select().from(artistsTable).where(eq(artistsTable.userId, req.user!.userId)).limit(1);
    if (!artist || existing.artistId !== artist.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
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

router.get("/songs/:id/comments", async (req, res): Promise<void> => {
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
    return { ...c, replies: replies.map(r => ({ ...r, replies: [] })) };
  }));

  res.json(withReplies);
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

  res.status(201).json({ ...comment, username: user?.username, avatarUrl: user?.avatarUrl, replies: [] });
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
