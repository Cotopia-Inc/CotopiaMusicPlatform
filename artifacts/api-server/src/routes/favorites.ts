import { Router } from "express";
import { eq, desc, and, avg } from "drizzle-orm";
import {
  db, favoritesTable, songsTable, videosTable, artistsTable, albumsTable, ratingsTable,
} from "@workspace/db";
import {
  FavoriteSongParams, UnfavoriteSongParams,
  FavoriteVideoParams, UnfavoriteVideoParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/favorites/songs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const favs = await db
    .select({
      id: songsTable.id,
      title: songsTable.title,
      artistId: songsTable.artistId,
      artistName: artistsTable.stageName,
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
    .from(favoritesTable)
    .leftJoin(songsTable, eq(favoritesTable.contentId, songsTable.id))
    .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
    .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
    .where(and(eq(favoritesTable.userId, req.user!.userId), eq(favoritesTable.contentType, "song")))
    .orderBy(desc(favoritesTable.createdAt));

  const withRatings = await Promise.all(favs.map(async (s) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable)
      .where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id!)));
    return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json(withRatings);
});

router.post("/favorites/songs/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = FavoriteSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.insert(favoritesTable).values({ userId: req.user!.userId, contentType: "song", contentId: params.data.id }).onConflictDoNothing();
  res.json({ ok: true });
});

router.delete("/favorites/songs/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UnfavoriteSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(favoritesTable).where(
    and(eq(favoritesTable.userId, req.user!.userId), eq(favoritesTable.contentType, "song"), eq(favoritesTable.contentId, params.data.id))
  );
  res.json({ ok: true });
});

router.get("/favorites/videos", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const favs = await db
    .select({
      id: videosTable.id,
      title: videosTable.title,
      artistId: videosTable.artistId,
      artistName: artistsTable.stageName,
      genre: videosTable.genre,
      duration: videosTable.duration,
      thumbnailUrl: videosTable.thumbnailUrl,
      videoUrl: videosTable.videoUrl,
      viewCount: videosTable.viewCount,
      status: videosTable.status,
      createdAt: videosTable.createdAt,
    })
    .from(favoritesTable)
    .leftJoin(videosTable, eq(favoritesTable.contentId, videosTable.id))
    .leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
    .where(and(eq(favoritesTable.userId, req.user!.userId), eq(favoritesTable.contentType, "video")))
    .orderBy(desc(favoritesTable.createdAt));

  const withRatings = await Promise.all(favs.map(async (v) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable)
      .where(and(eq(ratingsTable.contentType, "video"), eq(ratingsTable.contentId, v.id!)));
    return { ...v, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json(withRatings);
});

router.post("/favorites/videos/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = FavoriteVideoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.insert(favoritesTable).values({ userId: req.user!.userId, contentType: "video", contentId: params.data.id }).onConflictDoNothing();
  res.json({ ok: true });
});

router.delete("/favorites/videos/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UnfavoriteVideoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(favoritesTable).where(
    and(eq(favoritesTable.userId, req.user!.userId), eq(favoritesTable.contentType, "video"), eq(favoritesTable.contentId, params.data.id))
  );
  res.json({ ok: true });
});

export default router;
