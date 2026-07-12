import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  trustKnownIssuesTable, trustReleaseNotesTable, trustWeHeardYouTable,
  trustTimelineTable, trustAppealsTable,
} from "@workspace/db";
import { requireAuth, requireRole, optionalAuth, type AuthRequest } from "../lib/auth";

const router = Router();

const ADMIN_ROLES = ["admin", "master_admin"] as const;

// ── Public: list known issues ────────────────────────────────────────────────
router.get("/trust/known-issues", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(trustKnownIssuesTable)
    .where(eq(trustKnownIssuesTable.isPublic, true))
    .orderBy(desc(trustKnownIssuesTable.dateReported));
  res.json(rows);
});

// ── Public: list release notes ───────────────────────────────────────────────
router.get("/trust/release-notes", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(trustReleaseNotesTable)
    .where(eq(trustReleaseNotesTable.isPublic, true))
    .orderBy(desc(trustReleaseNotesTable.releaseDate));
  res.json(rows);
});

// ── Public: list we heard you ────────────────────────────────────────────────
router.get("/trust/we-heard-you", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(trustWeHeardYouTable)
    .where(eq(trustWeHeardYouTable.isPublic, true))
    .orderBy(desc(trustWeHeardYouTable.createdAt));
  res.json(rows);
});

// ── Public: list trust timeline ──────────────────────────────────────────────
router.get("/trust/timeline", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(trustTimelineTable)
    .where(eq(trustTimelineTable.isPublic, true))
    .orderBy(desc(trustTimelineTable.eventDate));
  res.json(rows);
});

// ── Public: submit an appeal ─────────────────────────────────────────────────
const AppealBody = z.object({
  submitterEmail: z.string().max(255).nullish(),
  submitterName: z.string().max(255).nullish(),
  actionType: z.string().min(1).max(100),
  relatedContent: z.string().max(500).nullish(),
  reason: z.string().min(10).max(5000),
  supportingInfo: z.string().max(5000).nullish(),
});

router.post("/trust/appeals", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = AppealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [appeal] = await db
    .insert(trustAppealsTable)
    .values({
      userId: req.user?.userId ?? null,
      submitterEmail: parsed.data.submitterEmail ?? null,
      submitterName: parsed.data.submitterName ?? null,
      actionType: parsed.data.actionType,
      relatedContent: parsed.data.relatedContent ?? null,
      reason: parsed.data.reason,
      supportingInfo: parsed.data.supportingInfo ?? null,
      status: "received",
    })
    .returning();
  res.status(201).json(appeal);
});

// ── Zod schemas for admin operations ────────────────────────────────────────
const KnownIssueBody = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  status: z.enum(["investigating", "identified", "fix_in_progress", "monitoring", "resolved"]).default("investigating"),
  affectedArea: z.string().max(255).nullish(),
  workaround: z.string().nullish(),
  isPublic: z.boolean().default(false),
  dateReported: z.string().nullish(),
  resolutionDate: z.string().nullish(),
});

const ReleaseNoteBody = z.object({
  version: z.string().min(1).max(50),
  releaseDate: z.string(),
  summary: z.string().min(1),
  newFeatures: z.string().nullish(),
  improvements: z.string().nullish(),
  bugFixes: z.string().nullish(),
  policyUpdates: z.string().nullish(),
  knownLimitations: z.string().nullish(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  isPublic: z.boolean().default(false),
});

const WeHeardYouBody = z.object({
  youAsked: z.string().min(1),
  weDid: z.string().min(1),
  status: z.enum(["requested", "planned", "in_progress", "released", "not_planned"]).default("released"),
  dateRequested: z.string().nullish(),
  dateReleased: z.string().nullish(),
  relatedFeature: z.string().max(255).nullish(),
  link: z.string().max(500).nullish(),
  isPublic: z.boolean().default(false),
});

const TimelineBody = z.object({
  eventDate: z.string(),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  category: z.string().max(100).default("Product"),
  isPublic: z.boolean().default(false),
});

const AppealUpdateBody = z.object({
  status: z.enum(["received", "under_review", "more_info_needed", "upheld", "reversed", "closed"]),
  adminNotes: z.string().nullish(),
});

// ── Admin: known issues CRUD ─────────────────────────────────────────────────
router.get("/admin/trust/known-issues", requireAuth, requireRole(ADMIN_ROLES), async (_req, res): Promise<void> => {
  const rows = await db.select().from(trustKnownIssuesTable).orderBy(desc(trustKnownIssuesTable.createdAt));
  res.json(rows);
});

router.post("/admin/trust/known-issues", requireAuth, requireRole(ADMIN_ROLES), async (req, res): Promise<void> => {
  const parsed = KnownIssueBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(trustKnownIssuesTable).values({
    ...parsed.data,
    dateReported: parsed.data.dateReported ? new Date(parsed.data.dateReported) : new Date(),
    resolutionDate: parsed.data.resolutionDate ? new Date(parsed.data.resolutionDate) : null,
  }).returning();
  res.status(201).json(row);
});

router.patch("/admin/trust/known-issues/:id", requireAuth, requireRole(ADMIN_ROLES), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const parsed = KnownIssueBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { dateReported, resolutionDate, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest };
  if (dateReported !== undefined) updates["dateReported"] = dateReported ? new Date(dateReported) : null;
  if (resolutionDate !== undefined) updates["resolutionDate"] = resolutionDate ? new Date(resolutionDate) : null;
  const [row] = await db.update(trustKnownIssuesTable).set(updates).where(eq(trustKnownIssuesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/admin/trust/known-issues/:id", requireAuth, requireRole(ADMIN_ROLES), async (req, res): Promise<void> => {
  await db.delete(trustKnownIssuesTable).where(eq(trustKnownIssuesTable.id, Number(req.params["id"])));
  res.status(204).send();
});

// ── Admin: release notes CRUD ────────────────────────────────────────────────
router.get("/admin/trust/release-notes", requireAuth, requireRole(ADMIN_ROLES), async (_req, res): Promise<void> => {
  const rows = await db.select().from(trustReleaseNotesTable).orderBy(desc(trustReleaseNotesTable.releaseDate));
  res.json(rows);
});

router.post("/admin/trust/release-notes", requireAuth, requireRole(ADMIN_ROLES), async (req, res): Promise<void> => {
  const parsed = ReleaseNoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(trustReleaseNotesTable).values({
    ...parsed.data,
    releaseDate: new Date(parsed.data.releaseDate),
  }).returning();
  res.status(201).json(row);
});

router.patch("/admin/trust/release-notes/:id", requireAuth, requireRole(ADMIN_ROLES), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const parsed = ReleaseNoteBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { releaseDate, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest };
  if (releaseDate !== undefined) updates["releaseDate"] = new Date(releaseDate);
  const [row] = await db.update(trustReleaseNotesTable).set(updates).where(eq(trustReleaseNotesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/admin/trust/release-notes/:id", requireAuth, requireRole(ADMIN_ROLES), async (req, res): Promise<void> => {
  await db.delete(trustReleaseNotesTable).where(eq(trustReleaseNotesTable.id, Number(req.params["id"])));
  res.status(204).send();
});

// ── Admin: we heard you CRUD ─────────────────────────────────────────────────
router.get("/admin/trust/we-heard-you", requireAuth, requireRole(ADMIN_ROLES), async (_req, res): Promise<void> => {
  const rows = await db.select().from(trustWeHeardYouTable).orderBy(desc(trustWeHeardYouTable.createdAt));
  res.json(rows);
});

router.post("/admin/trust/we-heard-you", requireAuth, requireRole(ADMIN_ROLES), async (req, res): Promise<void> => {
  const parsed = WeHeardYouBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(trustWeHeardYouTable).values({
    ...parsed.data,
    dateRequested: parsed.data.dateRequested ? new Date(parsed.data.dateRequested) : null,
    dateReleased: parsed.data.dateReleased ? new Date(parsed.data.dateReleased) : null,
  }).returning();
  res.status(201).json(row);
});

router.patch("/admin/trust/we-heard-you/:id", requireAuth, requireRole(ADMIN_ROLES), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const parsed = WeHeardYouBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { dateRequested, dateReleased, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest };
  if (dateRequested !== undefined) updates["dateRequested"] = dateRequested ? new Date(dateRequested) : null;
  if (dateReleased !== undefined) updates["dateReleased"] = dateReleased ? new Date(dateReleased) : null;
  const [row] = await db.update(trustWeHeardYouTable).set(updates).where(eq(trustWeHeardYouTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/admin/trust/we-heard-you/:id", requireAuth, requireRole(ADMIN_ROLES), async (req, res): Promise<void> => {
  await db.delete(trustWeHeardYouTable).where(eq(trustWeHeardYouTable.id, Number(req.params["id"])));
  res.status(204).send();
});

// ── Admin: trust timeline CRUD ───────────────────────────────────────────────
router.get("/admin/trust/timeline", requireAuth, requireRole(ADMIN_ROLES), async (_req, res): Promise<void> => {
  const rows = await db.select().from(trustTimelineTable).orderBy(desc(trustTimelineTable.eventDate));
  res.json(rows);
});

router.post("/admin/trust/timeline", requireAuth, requireRole(ADMIN_ROLES), async (req, res): Promise<void> => {
  const parsed = TimelineBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(trustTimelineTable).values({
    ...parsed.data,
    eventDate: new Date(parsed.data.eventDate),
  }).returning();
  res.status(201).json(row);
});

router.patch("/admin/trust/timeline/:id", requireAuth, requireRole(ADMIN_ROLES), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const parsed = TimelineBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { eventDate, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest };
  if (eventDate !== undefined) updates["eventDate"] = new Date(eventDate);
  const [row] = await db.update(trustTimelineTable).set(updates).where(eq(trustTimelineTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/admin/trust/timeline/:id", requireAuth, requireRole(ADMIN_ROLES), async (req, res): Promise<void> => {
  await db.delete(trustTimelineTable).where(eq(trustTimelineTable.id, Number(req.params["id"])));
  res.status(204).send();
});

// ── Admin: appeals management ────────────────────────────────────────────────
router.get("/admin/trust/appeals", requireAuth, requireRole(ADMIN_ROLES), async (req, res): Promise<void> => {
  const statusFilter = req.query["status"] as string | undefined;
  const where = statusFilter && statusFilter !== "all"
    ? eq(trustAppealsTable.status, statusFilter)
    : undefined;
  const rows = await db.select().from(trustAppealsTable)
    .where(where)
    .orderBy(desc(trustAppealsTable.createdAt));
  res.json(rows);
});

router.patch("/admin/trust/appeals/:id", requireAuth, requireRole(ADMIN_ROLES), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const parsed = AppealUpdateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(trustAppealsTable)
    .set({ status: parsed.data.status, adminNotes: parsed.data.adminNotes ?? null })
    .where(eq(trustAppealsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

export default router;
