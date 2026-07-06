import { Router } from "express";
import { eq, desc, count, and } from "drizzle-orm";
import {
  db, playlistsTable, playlistItemsTable, songsTable, artistsTable, albumsTable,
} from "@workspace/db";
import { requireAuth, requireRole, type AuthRequest } from "../lib/auth";
import { getTodayInReleaseTimezone } from "../lib/timezone";

const router = Router();

const EDITORIAL_ROLES = ["admin", "master_admin", "editor"] as const;
const STAFF_ROLES = ["admin", "master_admin", "editor", "moderator"];

// A song is publicly playable once it's published AND its releaseDate (if
// any) has arrived, in US Eastern Time (see lib/timezone.ts) — not server/DB
// UTC. This endpoint exposes the raw streamUrl directly to all logged-in
// users, so without this check an unreleased song added to an editorial
// playlist would be publicly playable ahead of its scheduled release date,
// bypassing the gating already enforced on /songs and /songs/:id.
function isSongReleased(status: string, releaseDate: string | null): boolean {
  const today = getTodayInReleaseTimezone();
  return status === "published" && (!releaseDate || releaseDate <= today);
}

// ── List editorial playlists ──────────────────────────────────────────────
router.get("/editorial-playlists", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: playlistsTable.id,
      userId: playlistsTable.userId,
      name: playlistsTable.name,
      description: playlistsTable.description,
      coverUrl: playlistsTable.coverUrl,
      isPublic: playlistsTable.isPublic,
      isEditorial: playlistsTable.isEditorial,
      playlistType: playlistsTable.playlistType,
      createdAt: playlistsTable.createdAt,
    })
    .from(playlistsTable)
    .where(eq(playlistsTable.isEditorial, true))
    .orderBy(desc(playlistsTable.createdAt));

  const withCounts = await Promise.all(rows.map(async (p) => {
    const [songCountRow] = await db
      .select({ count: count() })
      .from(playlistItemsTable)
      .where(eq(playlistItemsTable.playlistId, p.id));
    return { ...p, songCount: songCountRow?.count ?? 0 };
  }));

  res.json(withCounts);
});

// ── Get editorial playlist detail ─────────────────────────────────────────
router.get("/editorial-playlists/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID — please try again." }); return; }

  const [playlist] = await db.select().from(playlistsTable)
    .where(and(eq(playlistsTable.id, id), eq(playlistsTable.isEditorial, true)));
  if (!playlist) { res.status(404).json({ error: "Item not found." }); return; }

  const items = await db
    .select({
      id: songsTable.id, title: songsTable.title, artistId: songsTable.artistId,
      artistName: artistsTable.stageName, albumId: songsTable.albumId,
      albumName: albumsTable.title, genre: songsTable.genre, duration: songsTable.duration,
      coverUrl: songsTable.coverUrl, streamUrl: songsTable.streamUrl,
      playCount: songsTable.playCount, status: songsTable.status,
      releaseDate: songsTable.releaseDate, createdAt: songsTable.createdAt,
      position: playlistItemsTable.position,
    })
    .from(playlistItemsTable)
    .innerJoin(songsTable, eq(playlistItemsTable.songId, songsTable.id))
    .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
    .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
    .where(eq(playlistItemsTable.playlistId, id))
    .orderBy(playlistItemsTable.position);

  const isStaff = STAFF_ROLES.includes(req.user!.role);
  const visibleItems = isStaff ? items : items.filter((s) => isSongReleased(s.status, s.releaseDate));

  res.json({
    ...playlist,
    songCount: visibleItems.length,
    songs: visibleItems.map(({ position: _p, ...s }) => s),
  });
});

// ── Create editorial playlist ─────────────────────────────────────────────
router.post("/editorial-playlists", requireAuth, requireRole(...EDITORIAL_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const { name, description, coverUrl, isPublic, playlistType } = req.body as {
    name?: string;
    description?: string;
    coverUrl?: string;
    isPublic?: boolean;
    playlistType?: string;
  };

  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  if (!playlistType) { res.status(400).json({ error: "playlistType is required" }); return; }

  const [playlist] = await db.insert(playlistsTable).values({
    userId: req.user!.userId,
    name,
    description: description ?? null,
    coverUrl: coverUrl ?? null,
    isPublic: isPublic ?? true,
    isEditorial: true,
    playlistType,
  }).returning();

  res.status(201).json({ ...playlist, songCount: 0 });
});

// ── Update editorial playlist ─────────────────────────────────────────────
router.patch("/editorial-playlists/:id", requireAuth, requireRole(...EDITORIAL_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID — please try again." }); return; }

  const { name, description, coverUrl, isPublic, playlistType } = req.body as {
    name?: string;
    description?: string;
    coverUrl?: string;
    isPublic?: boolean;
    playlistType?: string;
  };

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (coverUrl !== undefined) update.coverUrl = coverUrl;
  if (isPublic !== undefined) update.isPublic = isPublic;
  if (playlistType !== undefined) update.playlistType = playlistType;

  const [updated] = await db.update(playlistsTable).set(update)
    .where(and(eq(playlistsTable.id, id), eq(playlistsTable.isEditorial, true)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Item not found." }); return; }

  const [countRow] = await db.select({ count: count() }).from(playlistItemsTable).where(eq(playlistItemsTable.playlistId, id));
  res.json({ ...updated, songCount: countRow?.count ?? 0 });
});

// ── Delete editorial playlist ─────────────────────────────────────────────
router.delete("/editorial-playlists/:id", requireAuth, requireRole(...EDITORIAL_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID — please try again." }); return; }

  await db.delete(playlistsTable).where(and(eq(playlistsTable.id, id), eq(playlistsTable.isEditorial, true)));
  res.status(204).end();
});

// ── Add song to editorial playlist ────────────────────────────────────────
router.post("/editorial-playlists/:id/songs", requireAuth, requireRole(...EDITORIAL_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID — please try again." }); return; }

  const { songId } = req.body as { songId?: number };
  if (!songId) { res.status(400).json({ error: "songId is required" }); return; }

  const [existing] = await db.select().from(playlistsTable)
    .where(and(eq(playlistsTable.id, id), eq(playlistsTable.isEditorial, true)));
  if (!existing) { res.status(404).json({ error: "Playlist not found" }); return; }

  const [maxRow] = await db
    .select({ maxPos: playlistItemsTable.position })
    .from(playlistItemsTable)
    .where(eq(playlistItemsTable.playlistId, id))
    .orderBy(desc(playlistItemsTable.position))
    .limit(1);

  const nextPosition = (maxRow?.maxPos ?? 0) + 1;

  await db.insert(playlistItemsTable).values({ playlistId: id, songId, position: nextPosition }).onConflictDoNothing();
  res.json({ ok: true });
});

// ── Remove song from editorial playlist ───────────────────────────────────
router.delete("/editorial-playlists/:id/songs/:songId", requireAuth, requireRole(...EDITORIAL_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const songId = parseInt(req.params.songId as string, 10);
  if (isNaN(id) || isNaN(songId)) { res.status(400).json({ error: "Invalid ID — please try again." }); return; }

  await db.delete(playlistItemsTable)
    .where(and(eq(playlistItemsTable.playlistId, id), eq(playlistItemsTable.songId, songId)));
  res.status(204).end();
});

export default router;
