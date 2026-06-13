import { Router } from "express";
import { eq, desc, ilike, and, count, avg, sql, or } from "drizzle-orm";
import {
  db, usersTable, submissionsTable, songsTable, videosTable, artistsTable,
  labelsTable, albumsTable, commentsTable, ratingsTable, analyticsEventsTable,
  appSettingsTable, followsTable, chatMessagesTable, favoritesTable,
  playlistsTable, playlistItemsTable, conversationsTable, directMessagesTable,
  dmcaClaimsTable, copyrightStrikesTable, adminAuditLogsTable,
} from "@workspace/db";
import {
  AdminListUsersQueryParams, AdminUpdateUserBody,
  AdminListSubmissionsQueryParams, UpdateAppSettingsBody,
  AdminUploadSongBody, AdminUploadVideoBody, AdminChangeUserRoleBody,
  AdminBulkUploadSongsBody, AdminBulkUploadVideosBody,
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

  const conditions: ReturnType<typeof eq>[] = [];
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

  const { title, artistId, albumId, genre, duration, streamUrl, coverUrl, releaseDate, releaseType, isFeatured } = parsed.data;

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
    releaseType: releaseType ?? "single",
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

router.post("/admin/bulk-upload-songs", requireAuth, requireRole(...ADMIN_ROLES, "editor"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = AdminBulkUploadSongsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { artistId, releaseName, releaseType: inputReleaseType, genre, coverUrl, releaseDate, isFeatured, songs } = parsed.data;

  const [artist] = await db.select({ id: artistsTable.id, stageName: artistsTable.stageName })
    .from(artistsTable).where(eq(artistsTable.id, artistId)).limit(1);
  if (!artist) { res.status(400).json({ error: "Artist not found" }); return; }

  // Auto-determine release type from count if not provided
  const count = songs.length;
  const releaseType = inputReleaseType ?? (count === 1 ? "single" : count <= 6 ? "ep" : "album");

  // Create album record for EP/album releases
  let albumId: number | null = null;
  if (releaseType !== "single" && releaseName) {
    const [album] = await db.insert(albumsTable).values({
      artistId,
      title: releaseName,
      coverUrl: coverUrl ?? null,
      genre: genre ?? null,
      releaseDate: releaseDate ?? null,
    }).returning();
    albumId = album.id;
  }

  // Insert all songs
  const inserted = await db.insert(songsTable).values(
    songs.map(s => ({
      title: s.title,
      artistId,
      albumId,
      genre: genre ?? null,
      duration: s.duration ?? 0,
      streamUrl: s.streamUrl,
      coverUrl: s.coverUrl ?? coverUrl ?? null,
      status: "published" as const,
      releaseType,
      isFeatured: isFeatured ?? false,
      releaseDate: releaseDate ?? null,
      playCount: 0,
    }))
  ).returning();

  res.status(201).json(inserted.map(song => ({
    ...song,
    artistName: artist.stageName,
    albumName: releaseName ?? null,
    avgRating: null,
  })));
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

router.post("/admin/bulk-upload-videos", requireAuth, requireRole(...ADMIN_ROLES, "editor"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = AdminBulkUploadVideosBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { artistId, genre, description, thumbnailUrl, releaseDate, isFeatured, videos } = parsed.data;

  const [artist] = await db.select({ id: artistsTable.id, stageName: artistsTable.stageName })
    .from(artistsTable).where(eq(artistsTable.id, artistId)).limit(1);
  if (!artist) { res.status(400).json({ error: "Artist not found" }); return; }

  const inserted = await db.insert(videosTable).values(
    videos.map((v: { title: string; videoUrl: string; duration?: number; thumbnailUrl?: string }) => ({
      title: v.title,
      artistId,
      genre: genre ?? null,
      description: description ?? null,
      duration: v.duration ?? 0,
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl ?? thumbnailUrl ?? null,
      status: "published" as const,
      isFeatured: isFeatured ?? false,
      releaseDate: releaseDate ?? null,
      viewCount: 0,
    }))
  ).returning();

  res.status(201).json(inserted.map(video => ({
    ...video,
    artistName: artist.stageName,
  })));
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
      isVerified: usersTable.isVerified, role: usersTable.role,
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

// ── Direct Message feed (admin / moderator moderation) ─────────────────────

router.get("/admin/messages", requireAuth, requireRole(...ADMIN_ROLES, "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const limit = Math.min(Number(req.query.limit ?? 50), 100);
  const offset = Number(req.query.offset ?? 0);

  const allConvs = await db
    .select({
      id: conversationsTable.id,
      participant1Id: conversationsTable.participant1Id,
      participant2Id: conversationsTable.participant2Id,
      lastMessageAt: conversationsTable.lastMessageAt,
    })
    .from(conversationsTable)
    .orderBy(desc(conversationsTable.lastMessageAt))
    .limit(200)
    .offset(0);

  const enriched = await Promise.all(allConvs.map(async (conv) => {
    const [p1] = await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, conv.participant1Id)).limit(1);
    const [p2] = await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, conv.participant2Id)).limit(1);
    const [lastMsg] = await db.select({ id: directMessagesTable.id, body: directMessagesTable.body, senderId: directMessagesTable.senderId, createdAt: directMessagesTable.createdAt }).from(directMessagesTable).where(eq(directMessagesTable.conversationId, conv.id)).orderBy(desc(directMessagesTable.createdAt)).limit(1);
    const [msgCount] = await db.select({ count: count() }).from(directMessagesTable).where(eq(directMessagesTable.conversationId, conv.id));
    return { id: conv.id, participant1: p1 ?? null, participant2: p2 ?? null, lastMessage: lastMsg ?? null, messageCount: msgCount?.count ?? 0, lastMessageAt: conv.lastMessageAt };
  }));

  const filtered = q
    ? enriched.filter(c =>
        [c.participant1?.username, c.participant2?.username, c.participant1?.displayName, c.participant2?.displayName]
          .some(s => s?.toLowerCase().includes(q))
      )
    : enriched;

  res.json(filtered.slice(offset, offset + limit));
});

router.get("/admin/messages/:convId", requireAuth, requireRole(...ADMIN_ROLES, "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const convId = parseInt(String(req.params["convId"] ?? "0"), 10);
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  const messages = await db
    .select({
      id: directMessagesTable.id, conversationId: directMessagesTable.conversationId,
      senderId: directMessagesTable.senderId, body: directMessagesTable.body,
      isRead: directMessagesTable.isRead, isEdited: directMessagesTable.isEdited,
      editedAt: directMessagesTable.editedAt, createdAt: directMessagesTable.createdAt,
      senderUsername: usersTable.username, senderDisplayName: usersTable.displayName,
      senderAvatarUrl: usersTable.avatarUrl, senderRole: usersTable.role,
    })
    .from(directMessagesTable)
    .leftJoin(usersTable, eq(directMessagesTable.senderId, usersTable.id))
    .where(eq(directMessagesTable.conversationId, convId))
    .orderBy(directMessagesTable.createdAt);

  res.json(messages);
});

router.put("/admin/messages/msg/:msgId", requireAuth, requireRole(...ADMIN_ROLES, "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const msgId = parseInt(String(req.params["msgId"] ?? "0"), 10);
  const { body } = req.body as { body: string };
  if (!body?.trim()) { res.status(400).json({ error: "body required" }); return; }
  const [updated] = await db.update(directMessagesTable).set({ body: body.trim(), isEdited: true, editedAt: new Date() }).where(eq(directMessagesTable.id, msgId)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/admin/messages/msg/:msgId", requireAuth, requireRole(...ADMIN_ROLES, "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const msgId = parseInt(String(req.params["msgId"] ?? "0"), 10);
  const [msg] = await db.select({ id: directMessagesTable.id }).from(directMessagesTable).where(eq(directMessagesTable.id, msgId)).limit(1);
  if (!msg) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(directMessagesTable).where(eq(directMessagesTable.id, msgId));
  res.json({ success: true });
});

// ── DMCA Claims ───────────────────────────────────────────────────────────────

router.get("/admin/dmca", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const { status } = req.query as { status?: string };
  const limit = Math.min(Number(req.query.limit ?? 50), 100);
  const offset = Number(req.query.offset ?? 0);

  const conditions = status ? [eq(dmcaClaimsTable.status, status)] : [];
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const claims = await db
    .select().from(dmcaClaimsTable)
    .where(whereClause)
    .orderBy(desc(dmcaClaimsTable.createdAt))
    .limit(limit).offset(offset);

  const [totalRow] = await db.select({ count: count() }).from(dmcaClaimsTable).where(whereClause);
  res.json({ items: claims, total: totalRow?.count ?? 0 });
});

router.get("/admin/dmca/:claimId", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params["claimId"] ?? "0"), 10);
  const [claim] = await db.select().from(dmcaClaimsTable).where(eq(dmcaClaimsTable.id, id)).limit(1);
  if (!claim) { res.status(404).json({ error: "Not found" }); return; }
  res.json(claim);
});

router.patch("/admin/dmca/:claimId", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params["claimId"] ?? "0"), 10);
  const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };

  const validStatuses = ["received", "under_review", "removed", "rejected", "counter_notice_received", "restored", "closed"];
  if (status && !validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (status) updateData.status = status;
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

  const [updated] = await db.update(dmcaClaimsTable).set(updateData).where(eq(dmcaClaimsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  await db.insert(adminAuditLogsTable).values({
    adminUserId: req.user!.userId,
    action: "dmca_status_update",
    targetType: "dmca_claim",
    targetId: id,
    description: `DMCA claim #${id} status updated to "${status ?? "unchanged"}"`,
    metadata: { status, adminNotes } as unknown,
  });

  res.json(updated);
});

router.post("/admin/dmca/:claimId/strike", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const claimId = parseInt(String(req.params["claimId"] ?? "0"), 10);
  const { userId, contentType, contentId, strikeReason } = req.body as Record<string, unknown>;

  if (!userId || !contentType || !contentId || !strikeReason) {
    res.status(400).json({ error: "userId, contentType, contentId, and strikeReason are required" });
    return;
  }

  const [strike] = await db.insert(copyrightStrikesTable).values({
    userId: Number(userId),
    contentType: String(contentType),
    contentId: Number(contentId),
    dmcaClaimId: claimId,
    strikeReason: String(strikeReason),
    status: "active",
  }).returning();

  await db.insert(adminAuditLogsTable).values({
    adminUserId: req.user!.userId,
    action: "copyright_strike_issued",
    targetType: "user",
    targetId: Number(userId),
    description: `Copyright strike issued to user #${userId} for ${contentType} #${contentId}`,
    metadata: { claimId, strikeReason } as unknown,
  });

  res.status(201).json(strike);
});

// ── Admin Audit Logs ──────────────────────────────────────────────────────────

router.get("/admin/audit-logs", requireAuth, requireRole("master_admin"), async (req: AuthRequest, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 100);
  const offset = Number(req.query.offset ?? 0);

  const logs = await db
    .select({
      id: adminAuditLogsTable.id,
      adminUserId: adminAuditLogsTable.adminUserId,
      adminUsername: usersTable.username,
      action: adminAuditLogsTable.action,
      targetType: adminAuditLogsTable.targetType,
      targetId: adminAuditLogsTable.targetId,
      description: adminAuditLogsTable.description,
      metadata: adminAuditLogsTable.metadata,
      createdAt: adminAuditLogsTable.createdAt,
    })
    .from(adminAuditLogsTable)
    .leftJoin(usersTable, eq(adminAuditLogsTable.adminUserId, usersTable.id))
    .orderBy(desc(adminAuditLogsTable.createdAt))
    .limit(limit).offset(offset);

  const [totalRow] = await db.select({ count: count() }).from(adminAuditLogsTable);
  res.json({ items: logs, total: totalRow?.count ?? 0 });
});

// ── Legal Settings (master_admin only) ───────────────────────────────────────

router.get("/admin/legal-settings", requireAuth, requireRole("master_admin"), async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(appSettingsTable).limit(1);
  if (!settings) [settings] = await db.insert(appSettingsTable).values({}).returning();
  res.json({
    termsVersion: settings.termsVersion,
    privacyVersion: settings.privacyVersion,
    submissionAgreementVersion: settings.submissionAgreementVersion,
    dmcaContactEmail: settings.dmcaContactEmail,
    copyrightAgentInfo: settings.copyrightAgentInfo,
    refundPolicyText: settings.refundPolicyText,
    aiPolicyText: settings.aiPolicyText,
    communityRulesText: settings.communityRulesText,
  });
});

router.patch("/admin/legal-settings", requireAuth, requireRole("master_admin"), async (req: AuthRequest, res): Promise<void> => {
  const allowed = ["termsVersion", "privacyVersion", "submissionAgreementVersion", "dmcaContactEmail", "copyrightAgentInfo", "refundPolicyText", "aiPolicyText", "communityRulesText"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in (req.body as Record<string, unknown>)) data[key] = (req.body as Record<string, unknown>)[key];
  }

  let [existing] = await db.select().from(appSettingsTable).limit(1);
  if (!existing) [existing] = await db.insert(appSettingsTable).values({}).returning();
  const [updated] = await db.update(appSettingsTable).set(data).where(eq(appSettingsTable.id, existing.id)).returning();

  await db.insert(adminAuditLogsTable).values({
    adminUserId: req.user!.userId,
    action: "legal_settings_updated",
    targetType: "app_settings",
    targetId: existing.id,
    description: `Legal settings updated (fields: ${Object.keys(data).join(", ")})`,
    metadata: { updatedFields: Object.keys(data) } as unknown,
  });

  res.json({
    termsVersion: updated.termsVersion,
    privacyVersion: updated.privacyVersion,
    submissionAgreementVersion: updated.submissionAgreementVersion,
    dmcaContactEmail: updated.dmcaContactEmail,
    copyrightAgentInfo: updated.copyrightAgentInfo,
    refundPolicyText: updated.refundPolicyText,
    aiPolicyText: updated.aiPolicyText,
    communityRulesText: updated.communityRulesText,
  });
});

// ── Copyright Strikes ─────────────────────────────────────────────────────────

router.get("/admin/strikes", requireAuth, requireRole(...ADMIN_ROLES, "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 100);
  const offset = Number(req.query.offset ?? 0);
  const userId = req.query.userId ? Number(req.query.userId) : undefined;

  const conditions = userId ? [eq(copyrightStrikesTable.userId, userId)] : [];

  const [strikes, [totalRow]] = await Promise.all([
    db
      .select({
        id: copyrightStrikesTable.id,
        userId: copyrightStrikesTable.userId,
        username: sql<string>`u.username`,
        email: sql<string>`u.email`,
        displayName: sql<string>`u.display_name`,
        contentType: copyrightStrikesTable.contentType,
        contentId: copyrightStrikesTable.contentId,
        contentTitle: copyrightStrikesTable.contentTitle,
        dmcaClaimId: copyrightStrikesTable.dmcaClaimId,
        strikeReason: copyrightStrikesTable.strikeReason,
        internalNotes: copyrightStrikesTable.internalNotes,
        issuedByUserId: copyrightStrikesTable.issuedByUserId,
        issuedByUsername: sql<string>`ib.username`,
        status: copyrightStrikesTable.status,
        createdAt: copyrightStrikesTable.createdAt,
        resolvedAt: copyrightStrikesTable.resolvedAt,
        resolvedReason: copyrightStrikesTable.resolvedReason,
      })
      .from(copyrightStrikesTable)
      .leftJoin(sql`users u`, sql`${copyrightStrikesTable.userId} = u.id`)
      .leftJoin(sql`users ib`, sql`${copyrightStrikesTable.issuedByUserId} = ib.id`)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(copyrightStrikesTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(copyrightStrikesTable).where(conditions.length ? and(...conditions) : undefined),
  ]);

  res.json({ items: strikes, total: totalRow?.count ?? 0 });
});

router.post("/admin/strikes", requireAuth, requireRole(...ADMIN_ROLES, "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const { userId, contentType, contentId, contentTitle, strikeReason, internalNotes, dmcaClaimId } = req.body as Record<string, unknown>;

  if (!contentType || !strikeReason) {
    res.status(400).json({ error: "contentType and strikeReason are required" });
    return;
  }

  // Resolve userId from content if not provided directly
  let resolvedUserId = userId ? Number(userId) : 0;
  if (!resolvedUserId && contentId) {
    if (contentType === "song") {
      const [song] = await db.select({ artistId: songsTable.artistId }).from(songsTable).where(eq(songsTable.id, Number(contentId))).limit(1);
      if (song) {
        const [artist] = await db.select({ userId: artistsTable.userId }).from(artistsTable).where(eq(artistsTable.id, song.artistId)).limit(1);
        if (artist) resolvedUserId = artist.userId;
      }
    } else if (contentType === "video") {
      const [video] = await db.select({ artistId: videosTable.artistId }).from(videosTable).where(eq(videosTable.id, Number(contentId))).limit(1);
      if (video) {
        const [artist] = await db.select({ userId: artistsTable.userId }).from(artistsTable).where(eq(artistsTable.id, video.artistId)).limit(1);
        if (artist) resolvedUserId = artist.userId;
      }
    }
  }

  if (!resolvedUserId) {
    res.status(400).json({ error: "userId is required (or provide contentType + contentId to resolve it)" });
    return;
  }

  const [target] = await db.select({ username: usersTable.username, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, resolvedUserId)).limit(1);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [strike] = await db.insert(copyrightStrikesTable).values({
    userId: resolvedUserId,
    contentType: String(contentType),
    contentId: contentId ? Number(contentId) : null,
    contentTitle: contentTitle ? String(contentTitle) : null,
    strikeReason: String(strikeReason),
    internalNotes: internalNotes ? String(internalNotes) : null,
    dmcaClaimId: dmcaClaimId ? Number(dmcaClaimId) : null,
    issuedByUserId: req.user!.userId,
    status: "active",
  }).returning();

  // Count active strikes to determine severity
  const [{ activeCount }] = await db.select({ activeCount: count() }).from(copyrightStrikesTable)
    .where(and(eq(copyrightStrikesTable.userId, resolvedUserId), eq(copyrightStrikesTable.status, "active")));

  await db.insert(adminAuditLogsTable).values({
    adminUserId: req.user!.userId,
    action: "copyright_strike_issued",
    targetType: "user",
    targetId: resolvedUserId,
    description: `Copyright strike issued to @${target.username} for ${contentType}${contentTitle ? ` "${contentTitle}"` : contentId ? ` #${contentId}` : ""}. Active strikes: ${activeCount}`,
    metadata: { strikeReason, contentType, contentId, contentTitle, activeStrikeCount: activeCount } as unknown,
  });

  res.status(201).json({ strike, activeStrikeCount: activeCount });
});

router.patch("/admin/strikes/:id/resolve", requireAuth, requireRole(...ADMIN_ROLES, "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { resolvedReason } = req.body as { resolvedReason?: string };

  const [existing] = await db.select({ userId: copyrightStrikesTable.userId }).from(copyrightStrikesTable).where(eq(copyrightStrikesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Strike not found" }); return; }

  const [strike] = await db.update(copyrightStrikesTable).set({
    status: "resolved",
    resolvedAt: new Date(),
    resolvedReason: resolvedReason ?? "Revoked by admin",
  }).where(eq(copyrightStrikesTable.id, id)).returning();

  await db.insert(adminAuditLogsTable).values({
    adminUserId: req.user!.userId,
    action: "copyright_strike_resolved",
    targetType: "user",
    targetId: existing.userId,
    description: `Copyright strike #${id} revoked${resolvedReason ? `: ${resolvedReason}` : ""}`,
    metadata: { strikeId: id, resolvedReason } as unknown,
  });

  res.json(strike);
});

router.get("/admin/users/:id/strikes", requireAuth, requireRole(...ADMIN_ROLES, "moderator"), async (req: AuthRequest, res): Promise<void> => {
  const idRaw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idRaw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const strikes = await db
    .select({
      id: copyrightStrikesTable.id,
      contentType: copyrightStrikesTable.contentType,
      contentId: copyrightStrikesTable.contentId,
      contentTitle: copyrightStrikesTable.contentTitle,
      strikeReason: copyrightStrikesTable.strikeReason,
      internalNotes: copyrightStrikesTable.internalNotes,
      status: copyrightStrikesTable.status,
      createdAt: copyrightStrikesTable.createdAt,
      resolvedAt: copyrightStrikesTable.resolvedAt,
      resolvedReason: copyrightStrikesTable.resolvedReason,
      issuedByUsername: sql<string>`ib.username`,
    })
    .from(copyrightStrikesTable)
    .leftJoin(sql`users ib`, sql`${copyrightStrikesTable.issuedByUserId} = ib.id`)
    .where(eq(copyrightStrikesTable.userId, id))
    .orderBy(desc(copyrightStrikesTable.createdAt));

  const activeCount = strikes.filter(s => s.status === "active").length;
  res.json({ strikes, activeCount, totalCount: strikes.length });
});

export default router;
