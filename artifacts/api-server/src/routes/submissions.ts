import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, submissionsTable, usersTable, songsTable, videosTable, artistsTable } from "@workspace/db";
import {
  CreateSubmissionBody, GetSubmissionParams,
  UpdateSubmissionParams, UpdateSubmissionBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";

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

  if (parsed.data.status === "published" && submission.contentId) {
    if (submission.type === "song") {
      await db.update(songsTable).set({ status: "published" }).where(eq(songsTable.id, submission.contentId));
    } else {
      await db.update(videosTable).set({ status: "published" }).where(eq(videosTable.id, submission.contentId));
    }
  }

  const enriched = await enrichSubmission(submission);
  res.json(enriched);
});

export default router;
