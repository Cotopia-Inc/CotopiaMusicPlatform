import { Router } from "express";
import { eq, desc, ilike, and, count, avg, sql, or } from "drizzle-orm";
import {
  db, labelsTable, artistsTable, songsTable, videosTable,
  followsTable, ratingsTable, albumsTable, usersTable, userBlocksTable,
} from "@workspace/db";
import {
  ListLabelsQueryParams, GetLabelParams, UpdateLabelParams, UpdateLabelBody,
  FollowLabelParams, UnfollowLabelParams,
} from "@workspace/api-zod";
import { requireAuth, optionalAuth, type AuthRequest } from "../lib/auth";

const router = Router();

async function getLabelRow(id: number, userId?: number) {
  const [label] = await db
    .select({ id: labelsTable.id, userId: labelsTable.userId, name: labelsTable.name, bio: sql<string | null>`COALESCE(${labelsTable.bio}, ${usersTable.bio})`, logoUrl: labelsTable.logoUrl, bannerUrl: labelsTable.bannerUrl, profileVideoUrl: usersTable.profileVideoUrl, createdAt: labelsTable.createdAt, isVerified: usersTable.isVerified, userRole: usersTable.role })
    .from(labelsTable)
    .innerJoin(usersTable, eq(labelsTable.userId, usersTable.id))
    .where(eq(labelsTable.id, id))
    .limit(1);
  if (!label) return null;

  const [fc] = await db.select({ count: count() }).from(followsTable)
    .where(and(eq(followsTable.targetType, "label"), eq(followsTable.targetId, id)));
  const [ac] = await db.select({ count: count() }).from(artistsTable).where(eq(artistsTable.labelId, id));

  let isFollowed = false;
  if (userId) {
    const [f] = await db.select().from(followsTable)
      .where(and(eq(followsTable.followerId, userId), eq(followsTable.targetType, "label"), eq(followsTable.targetId, id)));
    isFollowed = !!f;
  }

  return { ...label, followerCount: fc?.count ?? 0, artistCount: ac?.count ?? 0, isFollowed };
}

router.get("/labels", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = ListLabelsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { q, limit = 20 } = params.data;

  const conditions = q ? [ilike(labelsTable.name, `%${q}%`)] : [];
  const labels = await db
    .select({ id: labelsTable.id, userId: labelsTable.userId, name: labelsTable.name, bio: labelsTable.bio, logoUrl: labelsTable.logoUrl, bannerUrl: labelsTable.bannerUrl, createdAt: labelsTable.createdAt, isVerified: usersTable.isVerified, userRole: usersTable.role })
    .from(labelsTable)
    .innerJoin(usersTable, eq(labelsTable.userId, usersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(labelsTable.createdAt))
    .limit(limit);

  // Deduplicate — guard against multiple label records per user (e.g. from repeated seed runs).
  // Ordered by desc(createdAt) so the most recent record wins.
  const seen = new Set<number>();
  const unique = labels.filter(l => {
    if (!l.userId) return true;
    if (seen.has(l.userId)) return false;
    seen.add(l.userId);
    return true;
  });

  const withCounts = await Promise.all(unique.map(async (l) => {
    const [fc] = await db.select({ count: count() }).from(followsTable).where(and(eq(followsTable.targetType, "label"), eq(followsTable.targetId, l.id)));
    const [ac] = await db.select({ count: count() }).from(artistsTable).where(eq(artistsTable.labelId, l.id));
    let isFollowed = false;
    if (req.user) {
      const [f] = await db.select().from(followsTable).where(and(eq(followsTable.followerId, req.user.userId), eq(followsTable.targetType, "label"), eq(followsTable.targetId, l.id)));
      isFollowed = !!f;
    }
    return { ...l, followerCount: fc?.count ?? 0, artistCount: ac?.count ?? 0, isFollowed };
  }));

  res.json(withCounts);
});

router.get("/labels/featured", async (_req, res): Promise<void> => {
  const rawLabels = await db
    .select({ id: labelsTable.id, userId: labelsTable.userId, name: labelsTable.name, bio: labelsTable.bio, logoUrl: labelsTable.logoUrl, bannerUrl: labelsTable.bannerUrl, createdAt: labelsTable.createdAt, isVerified: usersTable.isVerified, userRole: usersTable.role })
    .from(labelsTable)
    .innerJoin(usersTable, eq(labelsTable.userId, usersTable.id))
    .orderBy(desc(labelsTable.createdAt))
    .limit(6);

  // Deduplicate — guard against multiple label records per user (e.g. from repeated seed runs).
  const seenFeatured = new Set<number>();
  const labels = rawLabels.filter(l => {
    if (!l.userId) return true;
    if (seenFeatured.has(l.userId)) return false;
    seenFeatured.add(l.userId);
    return true;
  });

  const withCounts = await Promise.all(labels.map(async (l) => {
    const [fc] = await db.select({ count: count() }).from(followsTable).where(and(eq(followsTable.targetType, "label"), eq(followsTable.targetId, l.id)));
    const [ac] = await db.select({ count: count() }).from(artistsTable).where(eq(artistsTable.labelId, l.id));
    return { ...l, followerCount: fc?.count ?? 0, artistCount: ac?.count ?? 0, isFollowed: false };
  }));

  res.json(withCounts);
});

router.get("/labels/:id", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetLabelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const label = await getLabelRow(params.data.id, req.user?.userId);
  if (!label) {
    res.status(404).json({ error: "Label not found" });
    return;
  }

  const artists = await db
    .select({ id: artistsTable.id, userId: artistsTable.userId, stageName: artistsTable.stageName, bio: artistsTable.bio, avatarUrl: sql<string | null>`COALESCE(${artistsTable.avatarUrl}, ${usersTable.avatarUrl})`, bannerUrl: artistsTable.bannerUrl, genre: artistsTable.genre, labelId: artistsTable.labelId, createdAt: artistsTable.createdAt, isVerified: usersTable.isVerified, userRole: usersTable.role })
    .from(artistsTable)
    .innerJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .where(eq(artistsTable.labelId, params.data.id))
    .limit(20);

  const artistsWithCounts = await Promise.all(artists.map(async (a) => {
    const [fc] = await db.select({ count: count() }).from(followsTable).where(and(eq(followsTable.targetType, "artist"), eq(followsTable.targetId, a.id)));
    const [sc] = await db.select({ count: count() }).from(songsTable).where(and(eq(songsTable.artistId, a.id), eq(songsTable.status, "published")));
    return { ...a, followerCount: fc?.count ?? 0, songCount: sc?.count ?? 0, isFollowed: false };
  }));

  // Recent releases from all label artists
  const artistIds = artists.map(a => a.id);
  const recentReleases = artistIds.length > 0
    ? await db
        .select({ id: songsTable.id, title: songsTable.title, artistId: songsTable.artistId, artistName: artistsTable.stageName, albumId: songsTable.albumId, albumName: albumsTable.title, genre: songsTable.genre, duration: songsTable.duration, coverUrl: songsTable.coverUrl, streamUrl: songsTable.streamUrl, playCount: songsTable.playCount, status: songsTable.status, createdAt: songsTable.createdAt })
        .from(songsTable)
        .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
        .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
        .where(and(eq(songsTable.status, "published")))
        .orderBy(desc(songsTable.createdAt))
        .limit(6)
    : [];

  const recentWithRatings = await Promise.all(recentReleases.map(async (s) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable).where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id)));
    return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json({ ...label, artists: artistsWithCounts, recentReleases: recentWithRatings });
});

router.patch("/labels/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateLabelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateLabelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.update(labelsTable).set(parsed.data).where(eq(labelsTable.id, params.data.id));
  const result = await getLabelRow(params.data.id, req.user?.userId);
  res.json(result);
});

router.post("/labels/:id/claim", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetLabelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [label] = await db.select().from(labelsTable).where(eq(labelsTable.id, params.data.id)).limit(1);
  if (!label) {
    res.status(404).json({ error: "Label not found" });
    return;
  }

  // Idempotent — already owned by the caller
  if (label.userId === req.user!.userId) {
    const result = await getLabelRow(label.id, req.user!.userId);
    res.json(result);
    return;
  }

  const [callerUser] = await db
    .select({ username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);

  if (!callerUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const nameMatches =
    label.name.trim().toLowerCase() === callerUser.username.trim().toLowerCase();

  if (!nameMatches) {
    res.status(403).json({
      error: "Label name does not match your username — claim denied.",
    });
    return;
  }

  await db
    .update(labelsTable)
    .set({ userId: req.user!.userId })
    .where(eq(labelsTable.id, label.id));

  const result = await getLabelRow(label.id, req.user!.userId);
  res.json(result);
});

router.post("/labels/:id/artists", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetLabelParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid label id" }); return; }

  const artistId = req.body?.artistId;
  if (!artistId || typeof artistId !== "number") {
    res.status(400).json({ error: "artistId is required" });
    return;
  }

  const [label] = await db.select().from(labelsTable).where(eq(labelsTable.id, params.data.id)).limit(1);
  if (!label) { res.status(404).json({ error: "Label not found" }); return; }

  const isAdmin = ["admin", "master_admin", "editor"].includes(req.user!.role);
  if (!isAdmin && label.userId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [artist] = await db.select().from(artistsTable).where(eq(artistsTable.id, artistId)).limit(1);
  if (!artist) { res.status(404).json({ error: "Artist not found" }); return; }

  await db.update(artistsTable).set({ labelId: params.data.id }).where(eq(artistsTable.id, artistId));
  res.json({ ok: true });
});

router.delete("/labels/:id/artists/:artistId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const labelId = Number(req.params.id);
  const artistId = Number(req.params.artistId);
  if (!labelId || !artistId) { res.status(400).json({ error: "Invalid ids" }); return; }

  const [label] = await db.select().from(labelsTable).where(eq(labelsTable.id, labelId)).limit(1);
  if (!label) { res.status(404).json({ error: "Label not found" }); return; }

  const isAdmin = ["admin", "master_admin", "editor"].includes(req.user!.role);
  if (!isAdmin && label.userId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.update(artistsTable).set({ labelId: null }).where(and(eq(artistsTable.id, artistId), eq(artistsTable.labelId, labelId)));
  res.json({ ok: true });
});

router.post("/labels/:id/follow", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = FollowLabelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const me = req.user!.userId;
  const [owner] = await db.select({ userId: labelsTable.userId }).from(labelsTable).where(eq(labelsTable.id, params.data.id)).limit(1);
  if (owner?.userId) {
    const [blocked] = await db.select({ id: userBlocksTable.id }).from(userBlocksTable).where(
      or(
        and(eq(userBlocksTable.blockerId, me), eq(userBlocksTable.blockedId, owner.userId)),
        and(eq(userBlocksTable.blockerId, owner.userId), eq(userBlocksTable.blockedId, me)),
      )
    ).limit(1);
    if (blocked) { res.status(403).json({ error: "Cannot follow this user" }); return; }
  }
  await db.insert(followsTable).values({ followerId: me, targetType: "label", targetId: params.data.id }).onConflictDoNothing();
  res.json({ ok: true });
});

router.delete("/labels/:id/follow", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UnfollowLabelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(followsTable).where(and(eq(followsTable.followerId, req.user!.userId), eq(followsTable.targetType, "label"), eq(followsTable.targetId, params.data.id)));
  res.json({ ok: true });
});

export default router;
