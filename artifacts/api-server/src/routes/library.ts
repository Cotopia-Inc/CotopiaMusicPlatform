import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, historyTable, songsTable, videosTable, artistsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/library/history", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "50"), 10);

  const history = await db.select().from(historyTable)
    .where(eq(historyTable.userId, req.user!.userId))
    .orderBy(desc(historyTable.playedAt))
    .limit(limit);

  const enriched = await Promise.all(history.map(async (h) => {
    if (h.contentType === "song") {
      const [s] = await db
        .select({ title: songsTable.title, coverUrl: songsTable.coverUrl, artistName: artistsTable.stageName })
        .from(songsTable)
        .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
        .where(eq(songsTable.id, h.contentId))
        .limit(1);
      return {
        id: h.id,
        type: h.contentType,
        contentId: h.contentId,
        contentTitle: s?.title ?? "",
        coverUrl: s?.coverUrl ?? null,
        artistName: s?.artistName ?? null,
        playedAt: h.playedAt,
      };
    } else {
      const [v] = await db
        .select({ title: videosTable.title, thumbnailUrl: videosTable.thumbnailUrl, artistName: artistsTable.stageName })
        .from(videosTable)
        .leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
        .where(eq(videosTable.id, h.contentId))
        .limit(1);
      return {
        id: h.id,
        type: h.contentType,
        contentId: h.contentId,
        contentTitle: v?.title ?? "",
        coverUrl: v?.thumbnailUrl ?? null,
        artistName: v?.artistName ?? null,
        playedAt: h.playedAt,
      };
    }
  }));

  res.json(enriched);
});

export default router;
