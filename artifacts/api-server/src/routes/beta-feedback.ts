import { Router } from "express";
import { eq, desc, and, count, ilike, or } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db, featureSuggestionsTable, experienceFeedbackTable, bugReportsTable, usersTable,
} from "@workspace/db";
import { optionalAuth, requireAuth, requireRole, type AuthRequest } from "../lib/auth";

const router = Router();

// Per-spec role sets — feature: admin/editor/moderator; experience: admin only; bug: admin/moderator
const FEATURE_ROLES = ["admin", "master_admin", "editor", "moderator"] as const;
const EXPERIENCE_ADMIN_ROLES = ["admin", "master_admin"] as const;
const BUG_ROLES = ["admin", "master_admin", "moderator"] as const;

// ── Feature Suggestions ───────────────────────────────────────────────────

const FeatureSuggestionInputSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  why: z.string().max(1000).optional(),
  category: z.enum(["music", "videos", "podcasts", "profile", "upload", "discovery", "payments", "community", "other"]).default("other"),
  priority: z.enum(["nice_to_have", "important", "urgent"]).default("nice_to_have"),
  userEmail: z.email().optional(),
});

router.post("/beta-feedback/feature-suggestions", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = FeatureSuggestionInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  let resolvedEmail: string | null = parsed.data.userEmail ?? null;
  if (req.user?.userId && !resolvedEmail) {
    const [u] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, req.user.userId)).limit(1);
    resolvedEmail = u?.email ?? null;
  }

  const [row] = await db.insert(featureSuggestionsTable).values({
    userId: req.user?.userId ?? null,
    userEmail: resolvedEmail,
    title: parsed.data.title,
    description: parsed.data.description,
    why: parsed.data.why ?? null,
    category: parsed.data.category,
    priority: parsed.data.priority,
    status: "new",
  }).returning();

  let username: string | null = null;
  if (row.userId) {
    const [u] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, row.userId)).limit(1);
    username = u?.username ?? null;
  }

  res.status(201).json({ ...row, username });
});

router.get("/admin/beta-feedback/feature-suggestions", requireAuth, requireRole(...FEATURE_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;
  const status = req.query.status as string | undefined;
  const category = req.query.category as string | undefined;

  const conditions: ReturnType<typeof eq>[] = [];
  if (status && status !== "all") conditions.push(eq(featureSuggestionsTable.status, status) as any);
  if (category && category !== "all") conditions.push(eq(featureSuggestionsTable.category, category) as any);

  const [items, [totalRow]] = await Promise.all([
    db.select().from(featureSuggestionsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(featureSuggestionsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(featureSuggestionsTable)
      .where(conditions.length ? and(...conditions) : undefined),
  ]);

  const enriched = await Promise.all(items.map(async (item) => {
    let username: string | null = null;
    if (item.userId) {
      const [u] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, item.userId)).limit(1);
      username = u?.username ?? null;
    }
    return { ...item, username };
  }));

  res.json({ items: enriched, total: totalRow?.count ?? 0 });
});

const AdminUpdateFeatureSuggestionSchema = z.object({
  status: z.enum(["new", "reviewed", "planned", "in_progress", "completed", "declined"]).optional(),
  adminNotes: z.string().optional(),
});

router.patch("/admin/beta-feedback/feature-suggestions/:id", requireAuth, requireRole(...FEATURE_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const idRaw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idRaw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = AdminUpdateFeatureSuggestionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [row] = await db.update(featureSuggestionsTable)
    .set(parsed.data)
    .where(eq(featureSuggestionsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  let username: string | null = null;
  if (row.userId) {
    const [u] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, row.userId)).limit(1);
    username = u?.username ?? null;
  }

  res.json({ ...row, username });
});

// ── Experience Feedback ───────────────────────────────────────────────────

const ExperienceFeedbackInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  whatWorkedWell: z.string().max(1000).optional(),
  whatWasConfusing: z.string().max(1000).optional(),
  didAnythingBreak: z.string().max(1000).optional(),
  wouldRecommend: z.boolean().optional(),
  trigger: z.enum(["after_upload", "after_submit", "first_visit", "manual", "general"]).default("general"),
});

router.post("/beta-feedback/experience-feedback", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = ExperienceFeedbackInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [row] = await db.insert(experienceFeedbackTable).values({
    userId: req.user?.userId ?? null,
    rating: parsed.data.rating,
    whatWorkedWell: parsed.data.whatWorkedWell ?? null,
    whatWasConfusing: parsed.data.whatWasConfusing ?? null,
    didAnythingBreak: parsed.data.didAnythingBreak ?? null,
    wouldRecommend: parsed.data.wouldRecommend ?? null,
    trigger: parsed.data.trigger,
  }).returning();

  let username: string | null = null;
  if (row.userId) {
    const [u] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, row.userId)).limit(1);
    username = u?.username ?? null;
  }

  res.status(201).json({ ...row, username });
});

router.get("/admin/beta-feedback/experience-feedback", requireAuth, requireRole(...EXPERIENCE_ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;
  const trigger = req.query.trigger as string | undefined;

  const conditions: ReturnType<typeof eq>[] = [];
  if (trigger && trigger !== "all") conditions.push(eq(experienceFeedbackTable.trigger, trigger) as any);

  const [items, [totalRow]] = await Promise.all([
    db.select().from(experienceFeedbackTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(experienceFeedbackTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(experienceFeedbackTable)
      .where(conditions.length ? and(...conditions) : undefined),
  ]);

  const enriched = await Promise.all(items.map(async (item) => {
    let username: string | null = null;
    if (item.userId) {
      const [u] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, item.userId)).limit(1);
      username = u?.username ?? null;
    }
    return { ...item, username };
  }));

  res.json({ items: enriched, total: totalRow?.count ?? 0 });
});

// ── Bug Reports ───────────────────────────────────────────────────────────

const BugReportInputSchema = z.object({
  whatHappened: z.string().min(10).max(2000),
  pageUrl: z.string().max(500).optional(),
  whatTrying: z.string().max(1000).optional(),
  deviceBrowser: z.string().max(300).optional(),
  severity: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  userEmail: z.email().optional(),
});

router.post("/beta-feedback/bug-reports", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = BugReportInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  let resolvedEmail: string | null = parsed.data.userEmail ?? null;
  if (req.user?.userId && !resolvedEmail) {
    const [u] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, req.user.userId)).limit(1);
    resolvedEmail = u?.email ?? null;
  }

  const [row] = await db.insert(bugReportsTable).values({
    userId: req.user?.userId ?? null,
    userEmail: resolvedEmail,
    whatHappened: parsed.data.whatHappened,
    pageUrl: parsed.data.pageUrl ?? null,
    whatTrying: parsed.data.whatTrying ?? null,
    deviceBrowser: parsed.data.deviceBrowser ?? null,
    severity: parsed.data.severity,
    status: "new",
  }).returning();

  let username: string | null = null;
  if (row.userId) {
    const [u] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, row.userId)).limit(1);
    username = u?.username ?? null;
  }

  res.status(201).json({ ...row, username });
});

router.get("/admin/beta-feedback/bug-reports", requireAuth, requireRole(...BUG_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;
  const status = req.query.status as string | undefined;
  const severity = req.query.severity as string | undefined;

  const conditions: ReturnType<typeof eq>[] = [];
  if (status && status !== "all") conditions.push(eq(bugReportsTable.status, status) as any);
  if (severity && severity !== "all") conditions.push(eq(bugReportsTable.severity, severity) as any);

  const [items, [totalRow]] = await Promise.all([
    db.select().from(bugReportsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(bugReportsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(bugReportsTable)
      .where(conditions.length ? and(...conditions) : undefined),
  ]);

  const enriched = await Promise.all(items.map(async (item) => {
    let username: string | null = null;
    if (item.userId) {
      const [u] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, item.userId)).limit(1);
      username = u?.username ?? null;
    }
    return { ...item, username };
  }));

  res.json({ items: enriched, total: totalRow?.count ?? 0 });
});

const AdminUpdateBugReportSchema = z.object({
  status: z.enum(["new", "confirmed", "investigating", "fixed", "closed"]).optional(),
  adminNotes: z.string().optional(),
});

router.patch("/admin/beta-feedback/bug-reports/:id", requireAuth, requireRole(...BUG_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const idRaw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idRaw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = AdminUpdateBugReportSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [row] = await db.update(bugReportsTable)
    .set(parsed.data)
    .where(eq(bugReportsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  let username: string | null = null;
  if (row.userId) {
    const [u] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, row.userId)).limit(1);
    username = u?.username ?? null;
  }

  res.json({ ...row, username });
});

export default router;
