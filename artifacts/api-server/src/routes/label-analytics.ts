import { Router } from "express";
import { eq, desc, and, count, sql, inArray } from "drizzle-orm";
import {
  db, labelsTable, artistsTable, songsTable, videosTable, followsTable, usersTable,
} from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/label/analytics", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (req.user!.role !== "label") {
    res.status(403).json({ error: "Forbidden: label role required" });
    return;
  }

  const [label] = await db
    .select({ id: labelsTable.id })
    .from(labelsTable)
    .where(eq(labelsTable.userId, req.user!.userId))
    .limit(1);

  if (!label) {
    res.status(404).json({ error: "Label profile not found" });
    return;
  }

  const artists = await db
    .select({
      id: artistsTable.id,
      stageName: artistsTable.stageName,
      avatarUrl: sql<string | null>`COALESCE(${artistsTable.avatarUrl}, ${usersTable.avatarUrl})`,
    })
    .from(artistsTable)
    .innerJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .where(eq(artistsTable.labelId, label.id))
    .orderBy(desc(artistsTable.createdAt));

  if (artists.length === 0) {
    res.json({ totalArtists: 0, totalPlays: 0, totalViews: 0, totalFollowers: 0, topArtists: [] });
    return;
  }

  const artistIds = artists.map((a) => a.id);

  const [playsByArtist, viewsByArtist, followersByArtist] = await Promise.all([
    db.select({
      artistId: songsTable.artistId,
      total: sql<number>`coalesce(sum(${songsTable.playCount}), 0)`,
    })
      .from(songsTable)
      .where(inArray(songsTable.artistId, artistIds))
      .groupBy(songsTable.artistId),

    db.select({
      artistId: videosTable.artistId,
      total: sql<number>`coalesce(sum(${videosTable.viewCount}), 0)`,
    })
      .from(videosTable)
      .where(inArray(videosTable.artistId, artistIds))
      .groupBy(videosTable.artistId),

    db.select({
      targetId: followsTable.targetId,
      count: count(),
    })
      .from(followsTable)
      .where(and(eq(followsTable.targetType, "artist"), inArray(followsTable.targetId, artistIds)))
      .groupBy(followsTable.targetId),
  ]);

  const playsMap = Object.fromEntries(playsByArtist.map((r) => [r.artistId, Number(r.total)]));
  const viewsMap = Object.fromEntries(viewsByArtist.map((r) => [r.artistId, Number(r.total)]));
  const followersMap = Object.fromEntries(followersByArtist.map((r) => [r.targetId, r.count]));

  const topArtists = artists
    .map((a) => ({
      id: a.id,
      stageName: a.stageName,
      avatarUrl: a.avatarUrl,
      totalPlays: playsMap[a.id] ?? 0,
      totalViews: viewsMap[a.id] ?? 0,
      followerCount: followersMap[a.id] ?? 0,
    }))
    .sort((a, b) => b.totalPlays - a.totalPlays);

  const totalPlays = Object.values(playsMap).reduce((s, v) => s + v, 0);
  const totalViews = Object.values(viewsMap).reduce((s, v) => s + v, 0);
  const totalFollowers = Object.values(followersMap).reduce((s, v) => s + v, 0);

  res.json({
    totalArtists: artists.length,
    totalPlays,
    totalViews,
    totalFollowers,
    topArtists,
  });
});

export default router;
