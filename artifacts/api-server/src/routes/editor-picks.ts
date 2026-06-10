import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, editorPicksTable, songsTable, videosTable, artistsTable, albumsTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthRequest } from "../lib/auth";
import { z } from "zod";

const router = Router();

const AddPickBody = z.object({
  contentType: z.enum(["song", "video", "artist"]),
  contentId: z.number().int().positive(),
  note: z.string().optional(),
  displayOrder: z.number().int().default(0),
});

const UpdatePickBody = z.object({
  note: z.string().optional().nullable(),
  displayOrder: z.number().int().optional(),
});

const PickIdParams = z.object({ id: z.coerce.number().int().positive() });

async function expandPick(pick: typeof editorPicksTable.$inferSelect, editorUsername?: string | null) {
  let song = null;
  let video = null;
  let artist = null;

  if (pick.contentType === "song") {
    const rows = await db
      .select({
        id: songsTable.id, title: songsTable.title, artistId: songsTable.artistId,
        artistName: artistsTable.stageName, albumId: songsTable.albumId,
        albumName: albumsTable.title, genre: songsTable.genre, duration: songsTable.duration,
        coverUrl: songsTable.coverUrl, streamUrl: songsTable.streamUrl,
        playCount: songsTable.playCount, status: songsTable.status,
        isFeatured: songsTable.isFeatured, createdAt: songsTable.createdAt,
        artistIsVerified: usersTable.isVerified,
      })
      .from(songsTable)
      .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
      .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
      .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
      .where(eq(songsTable.id, pick.contentId))
      .limit(1);
    song = rows[0] ?? null;
  } else if (pick.contentType === "video") {
    const rows = await db
      .select({
        id: videosTable.id, title: videosTable.title, artistId: videosTable.artistId,
        artistName: artistsTable.stageName, genre: videosTable.genre, duration: videosTable.duration,
        thumbnailUrl: videosTable.thumbnailUrl, videoUrl: videosTable.videoUrl,
        viewCount: videosTable.viewCount, status: videosTable.status,
        isFeatured: videosTable.isFeatured, createdAt: videosTable.createdAt,
        artistIsVerified: usersTable.isVerified,
      })
      .from(videosTable)
      .leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
      .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
      .where(eq(videosTable.id, pick.contentId))
      .limit(1);
    video = rows[0] ?? null;
  } else if (pick.contentType === "artist") {
    const rows = await db
      .select({
        id: artistsTable.id, userId: artistsTable.userId, stageName: artistsTable.stageName,
        bio: artistsTable.bio, avatarUrl: artistsTable.avatarUrl, bannerUrl: artistsTable.bannerUrl,
        genre: artistsTable.genre, labelId: artistsTable.labelId, createdAt: artistsTable.createdAt,
        isVerified: usersTable.isVerified,
      })
      .from(artistsTable)
      .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
      .where(eq(artistsTable.id, pick.contentId))
      .limit(1);
    artist = rows[0] ?? null;
  }

  return { ...pick, editorUsername: editorUsername ?? null, song, video, artist };
}

router.get("/editor-picks", async (_req, res): Promise<void> => {
  const picks = await db
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
    .orderBy(editorPicksTable.displayOrder, desc(editorPicksTable.createdAt));

  const expanded = await Promise.all(
    picks.map((p) => expandPick(p as any, p.editorUsername))
  );

  res.json(expanded.filter((p) => p.song || p.video || p.artist));
});

router.post("/editor-picks", requireAuth, requireRole("editor", "admin", "master_admin"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = AddPickBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [pick] = await db
    .insert(editorPicksTable)
    .values({ ...parsed.data, editorId: req.user!.userId })
    .returning();

  const editorRow = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  const expanded = await expandPick(pick, editorRow[0]?.username ?? null);
  res.status(201).json(expanded);
});

router.patch("/editor-picks/:id", requireAuth, requireRole("editor", "admin", "master_admin"), async (req: AuthRequest, res): Promise<void> => {
  const params = PickIdParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdatePickBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.note !== undefined) updateData.note = parsed.data.note;
  if (parsed.data.displayOrder !== undefined) updateData.displayOrder = parsed.data.displayOrder;

  const [pick] = await db
    .update(editorPicksTable)
    .set(updateData)
    .where(eq(editorPicksTable.id, params.data.id))
    .returning();

  if (!pick) { res.status(404).json({ error: "Pick not found" }); return; }

  const editor = pick.editorId
    ? await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, pick.editorId)).limit(1)
    : [];

  const expanded = await expandPick(pick, editor[0]?.username ?? null);
  res.json(expanded);
});

router.delete("/editor-picks/:id", requireAuth, requireRole("editor", "admin", "master_admin"), async (_req, res): Promise<void> => {
  const params = PickIdParams.safeParse(_req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(editorPicksTable).where(eq(editorPicksTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
