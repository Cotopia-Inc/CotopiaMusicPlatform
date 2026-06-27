import { Router } from "express";
import { eq, desc, and, count } from "drizzle-orm";
import { db, playlistsTable, playlistItemsTable, songsTable, artistsTable, albumsTable, ratingsTable, usersTable } from "@workspace/db";
import {
  GetPlaylistParams, UpdatePlaylistParams, UpdatePlaylistBody, DeletePlaylistParams,
  CreatePlaylistBody, AddSongToPlaylistParams, AddSongToPlaylistBody,
  RemoveSongFromPlaylistParams, ReorderPlaylistSongsParams, ReorderPlaylistSongsBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { avg } from "drizzle-orm";

const router = Router();

router.get("/playlists", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const playlists = await db.select().from(playlistsTable)
    .where(eq(playlistsTable.userId, req.user!.userId))
    .orderBy(desc(playlistsTable.createdAt));

  const withCounts = await Promise.all(playlists.map(async (p) => {
    const [c] = await db.select({ count: count() }).from(playlistItemsTable).where(eq(playlistItemsTable.playlistId, p.id));
    return { ...p, songCount: c?.count ?? 0 };
  }));

  res.json(withCounts);
});

router.post("/playlists", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreatePlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [playlist] = await db.insert(playlistsTable).values({
    userId: req.user!.userId,
    ...parsed.data,
  }).returning();

  res.status(201).json({ ...playlist, songCount: 0 });
});

router.get("/playlists/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetPlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, params.data.id)).limit(1);
  if (!playlist) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }

  const items = await db
    .select({
      id: songsTable.id,
      title: songsTable.title,
      artistId: songsTable.artistId,
      artistName: artistsTable.stageName,
      artistUserRole: usersTable.role,
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
    .from(playlistItemsTable)
    .leftJoin(songsTable, eq(playlistItemsTable.songId, songsTable.id))
    .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
    .where(eq(playlistItemsTable.playlistId, params.data.id))
    .orderBy(playlistItemsTable.position);

  const songsWithRatings = await Promise.all(items.map(async (s) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable)
      .where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id!)));
    return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json({ ...playlist, songCount: items.length, songs: songsWithRatings });
});

router.patch("/playlists/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdatePlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select({ userId: playlistsTable.userId }).from(playlistsTable).where(eq(playlistsTable.id, params.data.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }
  if (existing.userId !== req.user!.userId) {
    res.status(403).json({ error: "Not your playlist" });
    return;
  }

  const [playlist] = await db.update(playlistsTable).set(parsed.data).where(eq(playlistsTable.id, params.data.id)).returning();
  const [c] = await db.select({ count: count() }).from(playlistItemsTable).where(eq(playlistItemsTable.playlistId, params.data.id));
  res.json({ ...playlist, songCount: c?.count ?? 0 });
});

router.delete("/playlists/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = DeletePlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(playlistsTable).where(eq(playlistsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/playlists/:id/songs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = AddSongToPlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddSongToPlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select({ count: count() }).from(playlistItemsTable).where(eq(playlistItemsTable.playlistId, params.data.id));
  await db.insert(playlistItemsTable).values({
    playlistId: params.data.id,
    songId: parsed.data.songId,
    position: existing?.count ?? 0,
  }).onConflictDoNothing();

  res.json({ ok: true });
});

router.delete("/playlists/:id/songs/:songId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = RemoveSongFromPlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(playlistItemsTable).where(
    and(eq(playlistItemsTable.playlistId, params.data.id), eq(playlistItemsTable.songId, params.data.songId))
  );
  res.sendStatus(204);
});

router.put("/playlists/:id/songs/reorder", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = ReorderPlaylistSongsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = ReorderPlaylistSongsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select({ userId: playlistsTable.userId }).from(playlistsTable).where(eq(playlistsTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Playlist not found" }); return; }
  if (existing.userId !== req.user!.userId) { res.status(403).json({ error: "Not your playlist" }); return; }

  // Update each song's position in bulk
  await Promise.all(
    parsed.data.songIds.map((songId, idx) =>
      db.update(playlistItemsTable)
        .set({ position: idx })
        .where(and(eq(playlistItemsTable.playlistId, params.data.id), eq(playlistItemsTable.songId, songId)))
    )
  );

  res.sendStatus(204);
});

export default router;
