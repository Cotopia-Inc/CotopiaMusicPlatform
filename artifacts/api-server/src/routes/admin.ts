import { Router } from "express";
import { eq, desc, ilike, and, count, avg, sql, or } from "drizzle-orm";
import {
  db, usersTable, submissionsTable, songsTable, videosTable, artistsTable,
  labelsTable, albumsTable, commentsTable, ratingsTable, analyticsEventsTable,
  appSettingsTable, followsTable, chatMessagesTable, favoritesTable,
  playlistsTable, playlistItemsTable,
} from "@workspace/db";
import {
  AdminListUsersQueryParams, AdminUpdateUserBody,
  AdminListSubmissionsQueryParams, UpdateAppSettingsBody,
  AdminUploadSongBody, AdminUploadVideoBody, AdminChangeUserRoleBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole, type AuthRequest } from "../lib/auth";

const router = Router();

const ADMIN_ROLES = ["admin", "master_admin"] as const;

// ── Users ─────────────────────────────────────────────────────────────────

router.get("/admin/users", requireAuth, requireRole(...ADMIN_ROLES, "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const params = AdminListUsersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { role, q, limit = 50, offset = 0 } = params.data;

  const conditions: ReturnType<typeof eq>[] = [];
  if (role) conditions.push(eq(usersTable.role, role));
  if (q) conditions.push(ilike(usersTable.username, `%${q}%`));

  const [items, totalRow] = await Promise.all([
    db.select({
      id: usersTable.id, email: usersTable.email, username: usersTable.username,
      displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl,
      bio: usersTable.bio, role: usersTable.role, isActive: usersTable.isActive,
      isVerified: usersTable.isVerified, isSuspended: usersTable.isSuspended,
      createdAt: usersTable.createdAt,
    })
      .from(usersTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(usersTable).where(conditions.length ? and(...conditions) : undefined),
  ]);

  res.json({ items, total: totalRow[0]?.count ?? 0 });
});

router.patch("/admin/users/:id", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const idRaw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idRaw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AdminUpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, id)).returning();
  const { passwordHash: _, ...userOut } = user;
  res.json(userOut);
});

// ── Role Management (master_admin only) ──────────────────────────────────

router.patch("/admin/users/:id/role", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const idRaw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idRaw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AdminChangeUserRoleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Prevent changing your own role
  if (req.user!.userId === id) {
    res.status(400).json({ error: "Cannot change your own role" });
    return;
  }

  const callerRole = req.user!.role;
  const targetRole = parsed.data.role;

  // Only master_admin can assign master_admin
  if (targetRole === "master_admin" && callerRole !== "master_admin") {
    res.status(403).json({ error: "Only master admins can assign the master admin role" });
    return;
  }

  // Only admin or master_admin can assign admin
  if (targetRole === "admin" && callerRole !== "admin" && callerRole !== "master_admin") {
    res.status(403).json({ error: "Only admins can assign the admin role" });
    return;
  }

  const updateData: Record<string, unknown> = { role: parsed.data.role };
  if (parsed.data.isVerified !== undefined) updateData.isVerified = parsed.data.isVerified;
  if (parsed.data.isSuspended !== undefined) updateData.isSuspended = parsed.data.isSuspended;

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Log analytics event
  await db.insert(analyticsEventsTable).values({
    eventType: "admin",
    eventName: "role_changed",
    userId: req.user!.userId,
    contentType: "user",
    contentId: id,
    metadata: JSON.stringify({ newRole: parsed.data.role, reason: parsed.data.reason }),
  });

  const { passwordHash: _, ...userOut } = user;
  res.json(userOut);
});

// ── Submissions ──────────────────────────────────────────────────────────

router.get("/admin/submissions", requireAuth, requireRole(...ADMIN_ROLES, "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const params = AdminListSubmissionsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const conditions = params.data.status ? [eq(submissionsTable.status, params.data.status)] : [];
  const submissions = await db.select().from(submissionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(submissionsTable.createdAt));

  const enriched = await Promise.all(submissions.map(async (s) => {
    const [user] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, s.userId)).limit(1);
    let title = "";
    let mediaUrl: string | null = null;
    let coverUrl: string | null = null;
    if (s.contentId) {
      if (s.type === "song") {
        const [song] = await db.select({ title: songsTable.title, streamUrl: songsTable.streamUrl, coverUrl: songsTable.coverUrl }).from(songsTable).where(eq(songsTable.id, s.contentId)).limit(1);
        title = song?.title ?? ""; mediaUrl = song?.streamUrl ?? null; coverUrl = song?.coverUrl ?? null;
      } else {
        const [video] = await db.select({ title: videosTable.title, videoUrl: videosTable.videoUrl, thumbnailUrl: videosTable.thumbnailUrl }).from(videosTable).where(eq(videosTable.id, s.contentId)).limit(1);
        title = video?.title ?? ""; mediaUrl = video?.videoUrl ?? null; coverUrl = video?.thumbnailUrl ?? null;
      }
    }
    return { ...s, submitterName: user?.username ?? "", title, mediaUrl, coverUrl };
  }));

  res.json(enriched);
});

// ── Analytics ────────────────────────────────────────────────────────────

router.get("/admin/analytics", requireAuth, requireRole(...ADMIN_ROLES), async (_req, res): Promise<void> => {
  const [
    [totalUsersRow], [totalSongsRow], [totalVideosRow],
    [totalPlaysRow], [totalViewsRow], [totalCommentsRow], [pendingRow],
    [totalArtistsRow], [totalLabelsRow],
  ] = await Promise.all([
    db.select({ count: count() }).from(usersTable),
    db.select({ count: count() }).from(songsTable).where(eq(songsTable.status, "published")),
    db.select({ count: count() }).from(videosTable).where(eq(videosTable.status, "published")),
    db.select({ total: sql<number>`coalesce(sum(${songsTable.playCount}), 0)` }).from(songsTable),
    db.select({ total: sql<number>`coalesce(sum(${videosTable.viewCount}), 0)` }).from(videosTable),
    db.select({ count: count() }).from(commentsTable),
    db.select({ count: count() }).from(submissionsTable).where(eq(submissionsTable.status, "pending_review")),
    db.select({ count: count() }).from(artistsTable),
    db.select({ count: count() }).from(labelsTable),
  ]);

  const usersByRole = await db.select({ role: usersTable.role, count: count() }).from(usersTable).groupBy(usersTable.role);
  const usersByRoleObj: Record<string, number> = {};
  for (const r of usersByRole) usersByRoleObj[r.role] = r.count;

  const topSongs = await db
    .select({ id: songsTable.id, title: songsTable.title, artistId: songsTable.artistId, artistName: artistsTable.stageName, albumId: songsTable.albumId, albumName: albumsTable.title, genre: songsTable.genre, duration: songsTable.duration, coverUrl: songsTable.coverUrl, streamUrl: songsTable.streamUrl, playCount: songsTable.playCount, status: songsTable.status, createdAt: songsTable.createdAt })
    .from(songsTable).leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id)).leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
    .where(eq(songsTable.status, "published")).orderBy(desc(songsTable.playCount)).limit(10);

  const topVideos = await db
    .select({ id: videosTable.id, title: videosTable.title, artistId: videosTable.artistId, artistName: artistsTable.stageName, genre: videosTable.genre, duration: videosTable.duration, thumbnailUrl: videosTable.thumbnailUrl, videoUrl: videosTable.videoUrl, viewCount: videosTable.viewCount, status: videosTable.status, createdAt: videosTable.createdAt })
    .from(videosTable).leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
    .where(eq(videosTable.status, "published")).orderBy(desc(videosTable.viewCount)).limit(10);

  const topSongsWithRatings = await Promise.all(topSongs.map(async (s) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable).where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id)));
    return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json({
    totalUsers: totalUsersRow?.count ?? 0,
    totalSongs: totalSongsRow?.count ?? 0,
    totalVideos: totalVideosRow?.count ?? 0,
    totalArtists: totalArtistsRow?.count ?? 0,
    totalLabels: totalLabelsRow?.count ?? 0,
    totalPlays: Number(totalPlaysRow?.total ?? 0),
    totalViews: Number(totalViewsRow?.total ?? 0),
    totalComments: totalCommentsRow?.count ?? 0,
    pendingSubmissions: pendingRow?.count ?? 0,
    usersByRole: usersByRoleObj,
    topSongs: topSongsWithRatings,
    topVideos,
  });
});

// ── Listeners ────────────────────────────────────────────────────────────

router.get("/admin/listeners", requireAuth, requireRole(...ADMIN_ROLES, "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;
  const q = req.query.q as string | undefined;

  const conditions = [eq(usersTable.role, "listener")];
  if (q) conditions.push(or(ilike(usersTable.username, `%${q}%`), ilike(usersTable.email, `%${q}%`)) as any);

  const [listeners, [totalRow]] = await Promise.all([
    db.select({
      id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName,
      email: usersTable.email, avatarUrl: usersTable.avatarUrl,
      isVerified: usersTable.isVerified, isSuspended: usersTable.isSuspended,
      createdAt: usersTable.createdAt,
    })
      .from(usersTable).where(and(...conditions)).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset),
    db.select({ count: count() }).from(usersTable).where(and(...conditions)),
  ]);

  // Enrich with activity counts
  const enriched = await Promise.all(listeners.map(async (u) => {
    const [favCount, commentCount, followCount] = await Promise.all([
      db.select({ count: count() }).from(favoritesTable).where(eq(favoritesTable.userId, u.id)),
      db.select({ count: count() }).from(commentsTable).where(eq(commentsTable.userId, u.id)),
      db.select({ count: count() }).from(followsTable).where(eq(followsTable.followerId, u.id)),
    ]);
    return {
      ...u,
      favoriteCount: favCount[0]?.count ?? 0,
      commentCount: commentCount[0]?.count ?? 0,
      followCount: followCount[0]?.count ?? 0,
    };
  }));

  res.json({ items: enriched, total: totalRow?.count ?? 0 });
});

// ── Direct Upload (bypasses payment/submission) ──────────────────────────

router.post("/admin/upload-song", requireAuth, requireRole(...ADMIN_ROLES, "editor"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = AdminUploadSongBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { title, artistId, albumId, genre, duration, streamUrl, coverUrl, releaseDate, isFeatured } = parsed.data;

  // Verify artist exists
  const [artist] = await db.select({ id: artistsTable.id, stageName: artistsTable.stageName })
    .from(artistsTable).where(eq(artistsTable.id, artistId)).limit(1);
  if (!artist) { res.status(400).json({ error: "Artist not found" }); return; }

  const [song] = await db.insert(songsTable).values({
    title,
    artistId,
    albumId: albumId ?? null,
    genre: genre ?? null,
    duration: duration ?? 0,
    streamUrl,
    coverUrl: coverUrl ?? null,
    status: "published",
    isFeatured: isFeatured ?? false,
    releaseDate: releaseDate ?? null,
    playCount: 0,
  }).returning();

  res.status(201).json({
    ...song,
    artistName: artist.stageName,
    albumName: null,
    avgRating: null,
  });
});

router.post("/admin/upload-video", requireAuth, requireRole(...ADMIN_ROLES, "editor"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = AdminUploadVideoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { title, artistId, genre, description, duration, videoUrl, thumbnailUrl, releaseDate, isFeatured } = parsed.data;

  const [artist] = await db.select({ id: artistsTable.id, stageName: artistsTable.stageName })
    .from(artistsTable).where(eq(artistsTable.id, artistId)).limit(1);
  if (!artist) { res.status(400).json({ error: "Artist not found" }); return; }

  const [video] = await db.insert(videosTable).values({
    title,
    artistId,
    genre: genre ?? null,
    description: description ?? null,
    duration: duration ?? 0,
    videoUrl,
    thumbnailUrl: thumbnailUrl ?? null,
    status: "published",
    isFeatured: isFeatured ?? false,
    releaseDate: releaseDate ?? null,
    viewCount: 0,
  }).returning();

  res.status(201).json({
    ...video,
    artistName: artist.stageName,
  });
});

// ── App Settings ─────────────────────────────────────────────────────────

router.get("/admin/settings", requireAuth, requireRole(...ADMIN_ROLES), async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(appSettingsTable).limit(1);
  if (!settings) [settings] = await db.insert(appSettingsTable).values({}).returning();
  res.json({ ...settings, songSubmissionFee: parseFloat(settings.songSubmissionFee), videoSubmissionFee: parseFloat(settings.videoSubmissionFee) });
});

router.patch("/admin/settings", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const parsed = UpdateAppSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const dbData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.songSubmissionFee !== undefined) dbData.songSubmissionFee = String(parsed.data.songSubmissionFee);
  if (parsed.data.videoSubmissionFee !== undefined) dbData.videoSubmissionFee = String(parsed.data.videoSubmissionFee);

  let [existing] = await db.select().from(appSettingsTable).limit(1);
  if (!existing) [existing] = await db.insert(appSettingsTable).values({}).returning();

  const [updated] = await db.update(appSettingsTable).set(dbData).where(eq(appSettingsTable.id, existing.id)).returning();
  res.json({ ...updated, songSubmissionFee: parseFloat(updated.songSubmissionFee), videoSubmissionFee: parseFloat(updated.videoSubmissionFee) });
});

// ── Chat ─────────────────────────────────────────────────────────────────

router.get("/admin/chat", requireAuth, requireRole(...ADMIN_ROLES, "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const contentType = req.query.contentType as string | undefined;

  const messages = await db
    .select({
      id: chatMessagesTable.id, userId: chatMessagesTable.userId,
      username: usersTable.username, avatarUrl: usersTable.avatarUrl,
      contentType: chatMessagesTable.contentType, contentId: chatMessagesTable.contentId,
      message: chatMessagesTable.message, createdAt: chatMessagesTable.createdAt,
    })
    .from(chatMessagesTable)
    .innerJoin(usersTable, eq(chatMessagesTable.userId, usersTable.id))
    .where(contentType ? eq(chatMessagesTable.contentType, contentType) : undefined)
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(limit);

  res.json(messages);
});

export default router;
