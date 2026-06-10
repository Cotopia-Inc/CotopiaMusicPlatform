import { Router } from "express";
import { eq, desc, sql, ilike, and, count, avg } from "drizzle-orm";
import {
  db, videosTable, artistsTable, usersTable,
  commentsTable, ratingsTable, favoritesTable, historyTable,
} from "@workspace/db";
import {
  ListVideosQueryParams, CreateVideoBody, UpdateVideoBody,
  GetVideoParams, UpdateVideoParams, DeleteVideoParams,
  RecordVideoViewParams, GetVideoCommentsParams, CreateVideoCommentParams,
  CreateVideoCommentBody, RateVideoParams, RateVideoBody,
} from "@workspace/api-zod";
import { requireAuth, optionalAuth, type AuthRequest } from "../lib/auth";

const router = Router();

async function getVideoWithArtist(id: number, userId?: number) {
  const [row] = await db
    .select({
      id: videosTable.id,
      title: videosTable.title,
      artistId: videosTable.artistId,
      artistName: artistsTable.stageName,
      artistIsVerified: usersTable.isVerified,
      genre: videosTable.genre,
      duration: videosTable.duration,
      thumbnailUrl: videosTable.thumbnailUrl,
      videoUrl: videosTable.videoUrl,
      viewCount: videosTable.viewCount,
      isFeatured: videosTable.isFeatured,
      status: videosTable.status,
      description: videosTable.description,
      createdAt: videosTable.createdAt,
    })
    .from(videosTable)
    .leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .where(eq(videosTable.id, id))
    .limit(1);

  if (!row) return null;

  const [r] = await db.select({ avg: avg(ratingsTable.rating), count: count() }).from(ratingsTable)
    .where(and(eq(ratingsTable.contentType, "video"), eq(ratingsTable.contentId, id)));

  let userRating: number | null = null;
  let isFavorited = false;

  if (userId) {
    const [ur] = await db.select().from(ratingsTable)
      .where(and(eq(ratingsTable.userId, userId), eq(ratingsTable.contentType, "video"), eq(ratingsTable.contentId, id)));
    userRating = ur?.rating ?? null;

    const [fav] = await db.select().from(favoritesTable)
      .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.contentType, "video"), eq(favoritesTable.contentId, id)));
    isFavorited = !!fav;
  }

  const [commentCount] = await db.select({ count: count() }).from(commentsTable)
    .where(and(eq(commentsTable.contentType, "video"), eq(commentsTable.contentId, id)));

  return {
    ...row,
    avgRating: r?.avg ? parseFloat(r.avg) : null,
    commentCount: commentCount?.count ?? 0,
    userRating,
    isFavorited,
  };
}

router.get("/videos", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = ListVideosQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { q, artistId, limit = 20, offset = 0 } = params.data;

  const conditions = [eq(videosTable.status, "published")];
  if (q) conditions.push(ilike(videosTable.title, `%${q}%`));
  if (artistId) conditions.push(eq(videosTable.artistId, artistId));

  const items = await db
    .select({
      id: videosTable.id,
      title: videosTable.title,
      artistId: videosTable.artistId,
      artistName: artistsTable.stageName,
      artistIsVerified: usersTable.isVerified,
      genre: videosTable.genre,
      duration: videosTable.duration,
      thumbnailUrl: videosTable.thumbnailUrl,
      videoUrl: videosTable.videoUrl,
      viewCount: videosTable.viewCount,
      isFeatured: videosTable.isFeatured,
      status: videosTable.status,
      createdAt: videosTable.createdAt,
    })
    .from(videosTable)
    .leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .where(and(...conditions))
    .orderBy(desc(videosTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db.select({ count: count() }).from(videosTable).where(and(...conditions));

  const withRatings = await Promise.all(items.map(async (v) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable)
      .where(and(eq(ratingsTable.contentType, "video"), eq(ratingsTable.contentId, v.id)));
    return { ...v, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json({ items: withRatings, total: totalRow?.count ?? 0 });
});

router.get("/videos/featured", async (_req, res): Promise<void> => {
  const videos = await db
    .select({
      id: videosTable.id,
      title: videosTable.title,
      artistId: videosTable.artistId,
      artistName: artistsTable.stageName,
      artistIsVerified: usersTable.isVerified,
      genre: videosTable.genre,
      duration: videosTable.duration,
      thumbnailUrl: videosTable.thumbnailUrl,
      videoUrl: videosTable.videoUrl,
      viewCount: videosTable.viewCount,
      status: videosTable.status,
      createdAt: videosTable.createdAt,
    })
    .from(videosTable)
    .leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .where(and(eq(videosTable.isFeatured, true), eq(videosTable.status, "published")))
    .orderBy(desc(videosTable.createdAt))
    .limit(6);

  const withRatings = await Promise.all(videos.map(async (v) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable)
      .where(and(eq(ratingsTable.contentType, "video"), eq(ratingsTable.contentId, v.id)));
    return { ...v, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json(withRatings);
});

router.get("/videos/trending", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "10"), 10);
  const videos = await db
    .select({
      id: videosTable.id,
      title: videosTable.title,
      artistId: videosTable.artistId,
      artistName: artistsTable.stageName,
      artistIsVerified: usersTable.isVerified,
      genre: videosTable.genre,
      duration: videosTable.duration,
      thumbnailUrl: videosTable.thumbnailUrl,
      videoUrl: videosTable.videoUrl,
      viewCount: videosTable.viewCount,
      status: videosTable.status,
      createdAt: videosTable.createdAt,
    })
    .from(videosTable)
    .leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .where(eq(videosTable.status, "published"))
    .orderBy(desc(videosTable.viewCount))
    .limit(limit);

  const withRatings = await Promise.all(videos.map(async (v) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable)
      .where(and(eq(ratingsTable.contentType, "video"), eq(ratingsTable.contentId, v.id)));
    return { ...v, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json(withRatings);
});

router.get("/videos/:id", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetVideoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const video = await getVideoWithArtist(params.data.id, req.user?.userId);
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  res.json(video);
});

router.patch("/videos/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateVideoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(videosTable).where(eq(videosTable.id, params.data.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Video not found" });
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

  await db.update(videosTable).set(parsed.data).where(eq(videosTable.id, params.data.id));
  const result = await getVideoWithArtist(params.data.id, req.user?.userId);
  res.json(result);
});

router.delete("/videos/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteVideoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(videosTable).where(eq(videosTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/videos/:id/view", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = RecordVideoViewParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.update(videosTable).set({ viewCount: sql`${videosTable.viewCount} + 1` }).where(eq(videosTable.id, params.data.id));
  if (req.user) {
    await db.insert(historyTable).values({ userId: req.user.userId, contentType: "video", contentId: params.data.id });
  }
  res.json({ ok: true });
});

router.get("/videos/:id/comments", async (req, res): Promise<void> => {
  const params = GetVideoCommentsParams.safeParse(req.params);
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
      eq(commentsTable.contentType, "video"),
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

router.post("/videos/:id/comments", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = CreateVideoCommentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateVideoCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [comment] = await db.insert(commentsTable).values({
    userId: req.user!.userId,
    contentType: "video",
    contentId: params.data.id,
    content: parsed.data.content,
    parentId: parsed.data.parentId ?? null,
  }).returning();

  const [user] = await db.select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
    .from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);

  res.status(201).json({ ...comment, username: user?.username, avatarUrl: user?.avatarUrl, replies: [] });
});

router.post("/videos/:id/rate", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = RateVideoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = RateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.rating === 0) {
    await db.delete(ratingsTable).where(and(
      eq(ratingsTable.userId, req.user!.userId),
      eq(ratingsTable.contentType, "video"),
      eq(ratingsTable.contentId, params.data.id),
    ));
  } else {
    await db.insert(ratingsTable).values({
      userId: req.user!.userId,
      contentType: "video",
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
    .where(and(eq(ratingsTable.contentType, "video"), eq(ratingsTable.contentId, params.data.id)));

  res.json({ avgRating: parseFloat(result?.avg ?? "0"), ratingCount: result?.count ?? 0 });
});

router.post("/videos", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [artist] = await db.select().from(artistsTable).where(eq(artistsTable.userId, req.user!.userId)).limit(1);
  if (!artist) {
    res.status(403).json({ error: "Artist profile required" });
    return;
  }

  const [video] = await db.insert(videosTable).values({
    ...parsed.data,
    artistId: artist.id,
  }).returning();

  const result = await getVideoWithArtist(video.id, req.user?.userId);
  res.status(201).json(result);
});

export default router;
