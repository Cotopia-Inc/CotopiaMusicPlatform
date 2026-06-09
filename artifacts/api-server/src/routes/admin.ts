import { Router } from "express";
import { eq, desc, ilike, and, count, avg, sql } from "drizzle-orm";
import {
  db, usersTable, submissionsTable, songsTable, videosTable, artistsTable,
  labelsTable, albumsTable, commentsTable, ratingsTable, analyticsEventsTable,
  appSettingsTable, followsTable, chatMessagesTable,
} from "@workspace/db";
import {
  AdminListUsersQueryParams, AdminUpdateUserBody, AdminListUsersParams,
  AdminListSubmissionsQueryParams, UpdateAppSettingsBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/admin/users", requireAuth, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
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
    db.select({ id: usersTable.id, email: usersTable.email, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl, role: usersTable.role, isActive: usersTable.isActive, createdAt: usersTable.createdAt })
      .from(usersTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(usersTable).where(conditions.length ? and(...conditions) : undefined),
  ]);

  res.json({ items, total: totalRow[0]?.count ?? 0 });
});

router.patch("/admin/users/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const idRaw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idRaw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = AdminUpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, id)).returning();
  const { passwordHash: _, ...userOut } = user;
  res.json(userOut);
});

router.get("/admin/submissions", requireAuth, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const params = AdminListSubmissionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = params.data.status ? [eq(submissionsTable.status, params.data.status)] : [];
  const submissions = await db.select().from(submissionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(submissionsTable.createdAt));

  const enriched = await Promise.all(submissions.map(async (s) => {
    const [user] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, s.userId)).limit(1);
    let title = "";
    if (s.contentId) {
      if (s.type === "song") {
        const [song] = await db.select({ title: songsTable.title }).from(songsTable).where(eq(songsTable.id, s.contentId)).limit(1);
        title = song?.title ?? "";
      } else {
        const [video] = await db.select({ title: videosTable.title }).from(videosTable).where(eq(videosTable.id, s.contentId)).limit(1);
        title = video?.title ?? "";
      }
    }
    return { ...s, submitterName: user?.username ?? "", title };
  }));

  res.json(enriched);
});

router.get("/admin/analytics", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const [
    [totalUsersRow], [totalSongsRow], [totalVideosRow],
    [totalPlaysRow], [totalViewsRow], [totalCommentsRow], [pendingRow],
  ] = await Promise.all([
    db.select({ count: count() }).from(usersTable),
    db.select({ count: count() }).from(songsTable).where(eq(songsTable.status, "published")),
    db.select({ count: count() }).from(videosTable).where(eq(videosTable.status, "published")),
    db.select({ total: sql<number>`sum(${songsTable.playCount})` }).from(songsTable),
    db.select({ total: sql<number>`sum(${videosTable.viewCount})` }).from(videosTable),
    db.select({ count: count() }).from(commentsTable),
    db.select({ count: count() }).from(submissionsTable).where(eq(submissionsTable.status, "pending_review")),
  ]);

  const usersByRole = await db
    .select({ role: usersTable.role, count: count() })
    .from(usersTable)
    .groupBy(usersTable.role);

  const usersByRoleObj: Record<string, number> = {};
  for (const r of usersByRole) usersByRoleObj[r.role] = r.count;

  const topSongs = await db
    .select({ id: songsTable.id, title: songsTable.title, artistId: songsTable.artistId, artistName: artistsTable.stageName, albumId: songsTable.albumId, albumName: albumsTable.title, genre: songsTable.genre, duration: songsTable.duration, coverUrl: songsTable.coverUrl, streamUrl: songsTable.streamUrl, playCount: songsTable.playCount, status: songsTable.status, createdAt: songsTable.createdAt })
    .from(songsTable)
    .leftJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
    .leftJoin(albumsTable, eq(songsTable.albumId, albumsTable.id))
    .where(eq(songsTable.status, "published"))
    .orderBy(desc(songsTable.playCount))
    .limit(5);

  const topVideos = await db
    .select({ id: videosTable.id, title: videosTable.title, artistId: videosTable.artistId, artistName: artistsTable.stageName, genre: videosTable.genre, duration: videosTable.duration, thumbnailUrl: videosTable.thumbnailUrl, videoUrl: videosTable.videoUrl, viewCount: videosTable.viewCount, status: videosTable.status, createdAt: videosTable.createdAt })
    .from(videosTable)
    .leftJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
    .where(eq(videosTable.status, "published"))
    .orderBy(desc(videosTable.viewCount))
    .limit(5);

  const topSongsWithRatings = await Promise.all(topSongs.map(async (s) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable).where(and(eq(ratingsTable.contentType, "song"), eq(ratingsTable.contentId, s.id)));
    return { ...s, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  const topVideosWithRatings = await Promise.all(topVideos.map(async (v) => {
    const [r] = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable).where(and(eq(ratingsTable.contentType, "video"), eq(ratingsTable.contentId, v.id)));
    return { ...v, avgRating: r?.avg ? parseFloat(r.avg) : null };
  }));

  res.json({
    totalUsers: totalUsersRow?.count ?? 0,
    totalSongs: totalSongsRow?.count ?? 0,
    totalVideos: totalVideosRow?.count ?? 0,
    totalPlays: Number(totalPlaysRow?.total ?? 0),
    totalViews: Number(totalViewsRow?.total ?? 0),
    totalComments: totalCommentsRow?.count ?? 0,
    pendingSubmissions: pendingRow?.count ?? 0,
    usersByRole: usersByRoleObj,
    topSongs: topSongsWithRatings,
    topVideos: topVideosWithRatings,
  });
});

router.get("/admin/settings", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(appSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(appSettingsTable).values({}).returning();
  }
  res.json({ ...settings, songSubmissionFee: parseFloat(settings.songSubmissionFee), videoSubmissionFee: parseFloat(settings.videoSubmissionFee) });
});

router.patch("/admin/settings", requireAuth, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = UpdateAppSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dbData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.songSubmissionFee !== undefined) dbData.songSubmissionFee = String(parsed.data.songSubmissionFee);
  if (parsed.data.videoSubmissionFee !== undefined) dbData.videoSubmissionFee = String(parsed.data.videoSubmissionFee);

  let [existing] = await db.select().from(appSettingsTable).limit(1);
  if (!existing) {
    [existing] = await db.insert(appSettingsTable).values({}).returning();
  }

  const [updated] = await db.update(appSettingsTable).set(dbData).where(eq(appSettingsTable.id, existing.id)).returning();
  res.json({ ...updated, songSubmissionFee: parseFloat(updated.songSubmissionFee), videoSubmissionFee: parseFloat(updated.videoSubmissionFee) });
});

router.get("/admin/chat", requireAuth, requireRole("admin"), async (req: AuthRequest, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const contentType = req.query.contentType as string | undefined;

  const messages = await db
    .select({
      id: chatMessagesTable.id,
      userId: chatMessagesTable.userId,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      contentType: chatMessagesTable.contentType,
      contentId: chatMessagesTable.contentId,
      message: chatMessagesTable.message,
      createdAt: chatMessagesTable.createdAt,
    })
    .from(chatMessagesTable)
    .innerJoin(usersTable, eq(chatMessagesTable.userId, usersTable.id))
    .where(contentType ? eq(chatMessagesTable.contentType, contentType) : undefined)
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(limit);

  res.json(messages);
});

export default router;
