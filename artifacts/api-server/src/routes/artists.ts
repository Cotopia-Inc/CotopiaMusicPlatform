import { Router } from "express";
import { eq, desc, ilike, and, count, sql, or } from "drizzle-orm";
import {
  db, artistsTable, usersTable, songsTable, videosTable,
  followsTable, ratingsTable, albumsTable, labelsTable, userBlocksTable,
} from "@workspace/db";
import {
  ListArtistsQueryParams, GetArtistParams, UpdateArtistParams, UpdateArtistBody,
  FollowArtistParams, UnfollowArtistParams,
} from "@workspace/api-zod";
import { requireAuth, optionalAuth, type AuthRequest } from "../lib/auth";
import { avg } from "drizzle-orm";

const router = Router();

async function getArtistRow(id: number, userId?: number) {
  const [artist] = await db
    .select({
      id: artistsTable.id,
      userId: artistsTable.userId,
      stageName: artistsTable.stageName,
      bio: artistsTable.bio,
      bannerUrl: artistsTable.bannerUrl,
      genre: artistsTable.genre,
      labelId: artistsTable.labelId,
      createdAt: artistsTable.createdAt,
      avatarUrl: sql<string | null>`COALESCE(${artistsTable.avatarUrl}, ${usersTable.avatarUrl})`,
      isVerified: usersTable.isVerified,
      profileVideoUrl: usersTable.profileVideoUrl,
      userRole: usersTable.role,
    })
    .from(artistsTable)
    .innerJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .where(eq(artistsTable.id, id))
    .limit(1);

  if (!artist) return null;

  const [followerCount] = await db.select({ count: count() }).from(followsTable)
    .where(and(eq(followsTable.targetType, "artist"), eq(followsTable.targetId, id)));

  const [songCount] = await db.select({ count: count() }).from(songsTable)
    .where(and(eq(songsTable.artistId, id), eq(songsTable.status, "published")));

  let isFollowed = false;
  if (userId) {
    const [f] = await db.select().from(followsTable)
      .where(and(eq(followsTable.followerId, userId), eq(followsTable.targetType, "artist"), eq(followsTable.targetId, id)));
    isFollowed = !!f;
  }

  let labelName: string | null = null;
  if (artist.labelId) {
    const [label] = await db.select({ name: labelsTable.name }).from(labelsTable).where(eq(labelsTable.id, artist.labelId)).limit(1);
    labelName = label?.name ?? null;
  }

  return { ...artist, followerCount: followerCount?.count ?? 0, songCount: songCount?.count ?? 0, isFollowed, labelName };
}

router.get("/artists", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = ListArtistsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { q, limit = 20, offset = 0 } = params.data;

  // Always restrict to genuine artist/label accounts — admin upload forms use /admin/upload-accounts.
  const baseConditions: ReturnType<typeof eq>[] = [
    or(eq(usersTable.role, "artist"), eq(usersTable.role, "label")) as ReturnType<typeof eq>,
  ];
  if (q) baseConditions.push(ilike(artistsTable.stageName, `%${q}%`) as ReturnType<typeof eq>);

  const artists = await db
    .select({
      id: artistsTable.id,
      userId: artistsTable.userId,
      stageName: artistsTable.stageName,
      bio: artistsTable.bio,
      avatarUrl: sql<string | null>`COALESCE(${artistsTable.avatarUrl}, ${usersTable.avatarUrl})`,
      bannerUrl: artistsTable.bannerUrl,
      genre: artistsTable.genre,
      labelId: artistsTable.labelId,
      createdAt: artistsTable.createdAt,
      isVerified: usersTable.isVerified,
    })
    .from(artistsTable)
    .innerJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .where(baseConditions.length ? and(...baseConditions) : undefined)
    .orderBy(desc(artistsTable.createdAt))
    .limit(limit)
    .offset(offset);

  // Deduplicate — guard against any stale duplicate artist records per user
  const seen = new Set<number>();
  const unique = artists.filter(a => { if (!a.userId) return true; if (seen.has(a.userId)) return false; seen.add(a.userId); return true; });

  const withCounts = await Promise.all(unique.map(async (a) => {
    const [fc] = await db.select({ count: count() }).from(followsTable)
      .where(and(eq(followsTable.targetType, "artist"), eq(followsTable.targetId, a.id)));
    const [sc] = await db.select({ count: count() }).from(songsTable)
      .where(and(eq(songsTable.artistId, a.id), eq(songsTable.status, "published")));
    let isFollowed = false;
    if (req.user) {
      const [f] = await db.select().from(followsTable)
        .where(and(eq(followsTable.followerId, req.user.userId), eq(followsTable.targetType, "artist"), eq(followsTable.targetId, a.id)));
      isFollowed = !!f;
    }
    return { ...a, followerCount: fc?.count ?? 0, songCount: sc?.count ?? 0, isFollowed };
  }));

  res.json(withCounts);
});

router.get("/artists/new", async (_req, res): Promise<void> => {
  const artists = await db
    .select({ id: artistsTable.id, userId: artistsTable.userId, stageName: artistsTable.stageName, bio: artistsTable.bio, avatarUrl: sql<string | null>`COALESCE(${artistsTable.avatarUrl}, ${usersTable.avatarUrl})`, bannerUrl: artistsTable.bannerUrl, genre: artistsTable.genre, labelId: artistsTable.labelId, createdAt: artistsTable.createdAt, isVerified: usersTable.isVerified, userRole: usersTable.role })
    .from(artistsTable)
    .innerJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .where(or(eq(usersTable.role, "artist"), eq(usersTable.role, "label")))
    .orderBy(desc(artistsTable.createdAt))
    .limit(8);

  const withCounts = await Promise.all(artists.map(async (a) => {
    const [fc] = await db.select({ count: count() }).from(followsTable).where(and(eq(followsTable.targetType, "artist"), eq(followsTable.targetId, a.id)));
    const [sc] = await db.select({ count: count() }).from(songsTable).where(and(eq(songsTable.artistId, a.id), eq(songsTable.status, "published")));
    return { ...a, followerCount: fc?.count ?? 0, songCount: sc?.count ?? 0, isFollowed: false };
  }));

  res.json(withCounts);
});

router.get("/artists/featured", async (_req, res): Promise<void> => {
  const artists = await db
    .select({ id: artistsTable.id, userId: artistsTable.userId, stageName: artistsTable.stageName, bio: artistsTable.bio, avatarUrl: sql<string | null>`COALESCE(${artistsTable.avatarUrl}, ${usersTable.avatarUrl})`, bannerUrl: artistsTable.bannerUrl, genre: artistsTable.genre, labelId: artistsTable.labelId, createdAt: artistsTable.createdAt, isVerified: usersTable.isVerified, userRole: usersTable.role })
    .from(artistsTable)
    .innerJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .where(or(eq(usersTable.role, "artist"), eq(usersTable.role, "label")))
    .orderBy(desc(artistsTable.createdAt))
    .limit(6);

  const withCounts = await Promise.all(artists.map(async (a) => {
    const [fc] = await db.select({ count: count() }).from(followsTable).where(and(eq(followsTable.targetType, "artist"), eq(followsTable.targetId, a.id)));
    const [sc] = await db.select({ count: count() }).from(songsTable).where(and(eq(songsTable.artistId, a.id), eq(songsTable.status, "published")));
    return { ...a, followerCount: fc?.count ?? 0, songCount: sc?.count ?? 0, isFollowed: false };
  }));

  res.json(withCounts);
});

router.get("/artists/:id", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetArtistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const artist = await getArtistRow(params.data.id, req.user?.userId);
  if (!artist) {
    res.status(404).json({ error: "Artist not found" });
    return;
  }

  const songs = await db
    .select({ id: songsTable.id, title: songsTable.title, artistId: songsTable.artistId, artistName: artistsTable.stageName, artistUserRole: usersTable.role, artistIsVerified: usersTable.isVerified, albumId: songsTable.albumId, albumName: albumsTable.title, genre: songsTable.genre, duration: songsTable.duration, coverUrl: songsTable.coverUrl, streamUrl: songsTable.streamUrl, playCount: songsTable.playCount, status: songsTable.status, createdAt: songsTable.createdAt })
    .from(songsTable)
    .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
    .where(and(eq(songsTable.artistId, params.data.id), eq(songsTable.status, "published")))
    .orderBy(desc(songsTable.createdAt))
    .limit(10);

  const videos = await db
    .select({ id: videosTable.id, title: videosTable.title, artistId: videosTable.artistId, artistName: artistsTable.stageName, artistUserRole: usersTable.role, artistIsVerified: usersTable.isVerified, genre: videosTable.genre, duration: videosTable.duration, thumbnailUrl: videosTable.thumbnailUrl, videoUrl: videosTable.videoUrl, viewCount: videosTable.viewCount, status: videosTable.status, createdAt: videosTable.createdAt })
    .from(videosTable)
    .leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
    .leftJoin(usersTable, eq(artistsTable.userId, usersTable.id))
    .where(and(eq(videosTable.artistId, params.data.id), eq(videosTable.status, "published")))
    .orderBy(desc(videosTable.createdAt))
    .limit(10);

  const songsWithRatings = await Promise.all(songs.map(async (s) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable).where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id)));
    return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  const videosWithRatings = await Promise.all(videos.map(async (v) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable).where(and(eq(ratingsTable.contentType, "video"), eq(ratingsTable.contentId, v.id)));
    return { ...v, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json({ ...artist, songs: songsWithRatings, videos: videosWithRatings });
});

router.patch("/artists/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateArtistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateArtistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [artist] = await db.update(artistsTable).set(parsed.data).where(eq(artistsTable.id, params.data.id)).returning();
  const result = await getArtistRow(artist.id, req.user?.userId);
  res.json(result);
});

router.post("/artists/:id/claim", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetArtistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [artist] = await db.select().from(artistsTable).where(eq(artistsTable.id, params.data.id)).limit(1);
  if (!artist) {
    res.status(404).json({ error: "Artist not found" });
    return;
  }

  // Already owned by this user — idempotent success
  if (artist.userId === req.user!.userId) {
    const result = await getArtistRow(artist.id, req.user!.userId);
    res.json(result);
    return;
  }

  // Look up the caller's username and role to compare against the stage name
  const [callerUser] = await db
    .select({ username: usersTable.username, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);

  if (!callerUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const nameMatches =
    artist.stageName.trim().toLowerCase() === callerUser.username.trim().toLowerCase();

  if (!nameMatches) {
    res.status(403).json({
      error: "Artist stage name does not match your username — claim denied.",
    });
    return;
  }

  // Reassign the artist profile to the caller
  await db
    .update(artistsTable)
    .set({ userId: req.user!.userId })
    .where(eq(artistsTable.id, artist.id));

  // Upgrade role to artist only if the user is currently a plain listener —
  // never downgrade staff or existing business roles.
  if (callerUser.role === "listener") {
    await db
      .update(usersTable)
      .set({ role: "artist" })
      .where(eq(usersTable.id, req.user!.userId));
  }

  req.log.info(
    {
      artistId: artist.id,
      prevUserId: artist.userId,
      newUserId: req.user!.userId,
      roleUpgraded: callerUser.role === "listener",
    },
    "Artist profile claimed by matching username",
  );

  const result = await getArtistRow(artist.id, req.user!.userId);
  res.json(result);
});

router.post("/artists/:id/follow", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = FollowArtistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const me = req.user!.userId;
  const [owner] = await db.select({ userId: artistsTable.userId }).from(artistsTable).where(eq(artistsTable.id, params.data.id)).limit(1);
  if (owner?.userId) {
    const [blocked] = await db.select({ id: userBlocksTable.id }).from(userBlocksTable).where(
      or(
        and(eq(userBlocksTable.blockerId, me), eq(userBlocksTable.blockedId, owner.userId)),
        and(eq(userBlocksTable.blockerId, owner.userId), eq(userBlocksTable.blockedId, me)),
      )
    ).limit(1);
    if (blocked) { res.status(403).json({ error: "Cannot follow this user" }); return; }
  }
  await db.insert(followsTable).values({
    followerId: me,
    targetType: "artist",
    targetId: params.data.id,
  }).onConflictDoNothing();
  res.json({ ok: true });
});

router.delete("/artists/:id/follow", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UnfollowArtistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(followsTable).where(
    and(eq(followsTable.followerId, req.user!.userId), eq(followsTable.targetType, "artist"), eq(followsTable.targetId, params.data.id))
  );
  res.json({ ok: true });
});

export default router;
