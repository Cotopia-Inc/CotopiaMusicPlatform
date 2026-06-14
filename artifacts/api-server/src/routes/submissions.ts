import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, submissionsTable, usersTable, songsTable, videosTable, artistsTable, notificationsTable } from "@workspace/db";
import {
  CreateSubmissionBody, GetSubmissionParams,
  UpdateSubmissionParams, UpdateSubmissionBody,
  CreateBulkSubmissionBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { publishContent } from "../lib/publisher";

const router = Router();

async function enrichSubmission(s: typeof submissionsTable.$inferSelect) {
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
}

router.get("/submissions", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const conditions = req.user!.role === "admin"
    ? []
    : [eq(submissionsTable.userId, req.user!.userId)];

  const submissions = await db.select().from(submissionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(submissionsTable.createdAt));

  const enriched = await Promise.all(submissions.map(enrichSubmission));
  res.json(enriched);
});

router.post("/submissions", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateSubmissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;

  // Staff accounts must not submit content via this form
  const STAFF_ROLES = ["admin", "master_admin", "editor", "moderator"];
  if (STAFF_ROLES.includes(req.user!.role)) {
    res.status(403).json({ error: "Staff accounts cannot submit content through this form. Use the admin panel to add content directly." });
    return;
  }

  // Find or create artist profile for this user
  let [artist] = await db.select().from(artistsTable).where(eq(artistsTable.userId, req.user!.userId)).limit(1);
  if (!artist) {
    const [user] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    const stageName = d.artistName || user?.username || "Unknown Artist";
    [artist] = await db.insert(artistsTable).values({
      userId: req.user!.userId,
      stageName,
    }).returning();
  }

  // Extra metadata stored as JSON
  const metaFields = {
    labelName: d.labelName,
    mood: d.mood,
    description: d.description,
    releaseDate: d.releaseDate,
    isExplicit: d.isExplicit ?? false,
    artistName: d.artistName,
  };
  const submitterNotes = JSON.stringify(metaFields);

  let contentId: number;

  if (d.type === "song") {
    const [song] = await db.insert(songsTable).values({
      artistId: artist.id,
      title: d.title,
      genre: d.genre ?? null,
      coverUrl: d.coverUrl ?? null,
      streamUrl: d.fileUrl ?? null,
      status: "draft",
      duration: 0,
      releaseDate: d.releaseDate ?? null,
    }).returning();
    contentId = song.id;
  } else {
    const [video] = await db.insert(videosTable).values({
      artistId: artist.id,
      title: d.title,
      genre: d.genre ?? null,
      description: d.description ?? null,
      thumbnailUrl: d.coverUrl ?? null,
      videoUrl: d.fileUrl ?? null,
      status: "draft",
      duration: 0,
      releaseDate: d.releaseDate ?? null,
    }).returning();
    contentId = video.id;
  }

  const [submission] = await db.insert(submissionsTable).values({
    userId: req.user!.userId,
    type: d.type,
    contentId,
    plan: d.plan ?? "basic",
    status: "draft",
    paymentStatus: "unpaid",
    submitterNotes,
  }).returning();

  const enriched = await enrichSubmission(submission);
  res.status(201).json(enriched);
});

router.post("/submissions/bulk", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateBulkSubmissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;

  // Staff accounts must not submit content via this form
  const STAFF_ROLES_BULK = ["admin", "master_admin", "editor", "moderator"];
  if (STAFF_ROLES_BULK.includes(req.user!.role)) {
    res.status(403).json({ error: "Staff accounts cannot submit content through this form. Use the admin panel to add content directly." });
    return;
  }

  // Find or create artist profile for this user
  let [artist] = await db.select().from(artistsTable).where(eq(artistsTable.userId, req.user!.userId)).limit(1);
  if (!artist) {
    const [user] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    const stageName = d.artistName || user?.username || "Unknown Artist";
    [artist] = await db.insert(artistsTable).values({
      userId: req.user!.userId,
      stageName,
    }).returning();
  }

  const metaFields = {
    labelName: d.labelName,
    mood: d.mood,
    description: d.description,
    releaseDate: d.releaseDate,
    isExplicit: d.isExplicit ?? false,
    artistName: d.artistName,
  };
  const submitterNotes = JSON.stringify(metaFields);

  const results: object[] = [];

  for (const file of d.files) {
    let contentId: number;

    if (d.type === "song") {
      const [song] = await db.insert(songsTable).values({
        artistId: artist.id,
        title: file.title,
        genre: d.genre ?? null,
        coverUrl: d.coverUrl ?? null,
        streamUrl: file.fileUrl,
        status: "draft",
        duration: 0,
        releaseDate: d.releaseDate ?? null,
      }).returning();
      contentId = song.id;
    } else {
      const [video] = await db.insert(videosTable).values({
        artistId: artist.id,
        title: file.title,
        genre: d.genre ?? null,
        description: d.description ?? null,
        thumbnailUrl: d.coverUrl ?? null,
        videoUrl: file.fileUrl,
        status: "draft",
        duration: 0,
        releaseDate: d.releaseDate ?? null,
      }).returning();
      contentId = video.id;
    }

    const [submission] = await db.insert(submissionsTable).values({
      userId: req.user!.userId,
      type: d.type,
      contentId,
      plan: d.plan ?? "basic",
      status: "draft",
      paymentStatus: "unpaid",
      submitterNotes,
    }).returning();

    const enriched = await enrichSubmission(submission);
    results.push(enriched);
  }

  res.status(201).json(results);
});

router.get("/submissions/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetSubmissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, params.data.id)).limit(1);
  if (!submission) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  const enriched = await enrichSubmission(submission);
  res.json(enriched);
});

router.patch("/submissions/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateSubmissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSubmissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [submission] = await db.update(submissionsTable)
    .set({ ...parsed.data })
    .where(eq(submissionsTable.id, params.data.id))
    .returning();

  // ── Approval flow ────────────────────────────────────────────────────────
  if (parsed.data.status === "approved" && submission.contentId) {
    const enriched = await enrichSubmission(submission);

    // Parse releaseDate from submitterNotes JSON
    let releaseDate: string | null = null;
    try {
      const meta = JSON.parse(submission.submitterNotes ?? "{}");
      if (meta.releaseDate) releaseDate = meta.releaseDate as string;
    } catch { /* ignore */ }

    const today = new Date().toISOString().slice(0, 10);
    const hasFutureDate = releaseDate && releaseDate > today;

    if (hasFutureDate) {
      // Store releaseDate on the content row and leave it as "approved" (not published yet)
      if (submission.type === "song") {
        await db.update(songsTable).set({ status: "approved", releaseDate }).where(eq(songsTable.id, submission.contentId));
      } else {
        await db.update(videosTable).set({ status: "approved", releaseDate }).where(eq(videosTable.id, submission.contentId));
      }

      // Notify the submitter of the scheduled release date
      await db.insert(notificationsTable).values({
        userId: submission.userId,
        type: "submission_approved",
        title: `"${enriched.title}" approved — scheduled for ${releaseDate}`,
        message: parsed.data.adminNotes
          ? `Admin note: ${parsed.data.adminNotes}. Your content will go live on ${releaseDate}.`
          : `Your content is approved and will be published automatically on ${releaseDate}. Stay tuned!`,
        submissionId: submission.id,
        isRead: false,
      });
    } else {
      // No future date — publish immediately
      await publishContent(submission.type as "song" | "video", submission.contentId, { submissionId: submission.id });

      // Notify submitter
      await db.insert(notificationsTable).values({
        userId: submission.userId,
        type: "submission_approved",
        title: `"${enriched.title}" is now live!`,
        message: parsed.data.adminNotes
          ? `Admin note: ${parsed.data.adminNotes}`
          : "Your submission has been approved and published. Thanks for your contribution!",
        submissionId: submission.id,
        isRead: false,
      });
    }
  }

  // ── Rejection flow ───────────────────────────────────────────────────────
  if (parsed.data.status === "rejected") {
    const enriched = await enrichSubmission(submission);
    await db.insert(notificationsTable).values({
      userId: submission.userId,
      type: "submission_rejected",
      title: `"${enriched.title}" was not approved`,
      message: parsed.data.adminNotes
        ? `Admin note: ${parsed.data.adminNotes}`
        : "Your submission did not meet our current requirements. You're welcome to revise and resubmit.",
      submissionId: submission.id,
      isRead: false,
    });
  }

  // ── Manual publish (legacy path) ─────────────────────────────────────────
  if (parsed.data.status === "published" && submission.contentId) {
    await publishContent(submission.type as "song" | "video", submission.contentId, { submissionId: submission.id });
  }

  const enriched = await enrichSubmission(submission);
  res.json(enriched);
});

router.delete("/submissions/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetSubmissionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, params.data.id)).limit(1);
  if (!submission) { res.status(404).json({ error: "Submission not found" }); return; }

  const isAdmin = req.user!.role === "admin" || req.user!.role === "master_admin" || req.user!.role === "editor";
  if (!isAdmin && submission.userId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(submissionsTable).where(eq(submissionsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
