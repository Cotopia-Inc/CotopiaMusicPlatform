import { Router } from "express";
import { eq, and, or, gte, desc, count, countDistinct, sql } from "drizzle-orm";
import {
  db, creatorPaymentSettingsTable, supportTransactionsTable,
  songsTable, videosTable, artistsTable, labelsTable, usersTable,
  notificationsTable, followsTable, analyticsEventsTable, adminAuditLogsTable,
} from "@workspace/db";
import {
  UpdateCreatorSupportSettingsBody, CreateSupportTipBody,
  GetCreatorSupportStatusQueryParams, GetSupportWallQueryParams,
  UpdateSupportTransactionStatusBody, UpdateSupportWallModerationBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole, type AuthRequest } from "../lib/auth";
import { evaluateSupportBadges } from "../lib/support-badges";

const router = Router();

const ADMIN_ROLES = ["admin", "master_admin"] as const;
const SUPPORTABLE_TYPES = ["song", "video", "artist", "label", "creator"] as const;
type SupportableType = (typeof SUPPORTABLE_TYPES)[number];

// ── Demo-mode spam guard ────────────────────────────────────────────────────
// No shared rate-limit middleware exists in this codebase yet, so this is a
// small in-memory guard scoped to this route: max 5 support attempts per
// supporter per rolling 60s window. Resets on server restart — acceptable for
// demo mode; revisit with a durable store if this ships to real payments.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const recentAttempts = new Map<number, number[]>();

function isRateLimited(userId: number): boolean {
  const now = Date.now();
  const attempts = (recentAttempts.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (attempts.length >= RATE_LIMIT_MAX) {
    recentAttempts.set(userId, attempts);
    return true;
  }
  attempts.push(now);
  recentAttempts.set(userId, attempts);
  return false;
}

function generateTransactionRef(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `SUP-DEMO-${num}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────
async function resolveSupportRecipient(contentType: string, contentId: number): Promise<{ recipientUserId: number; creatorName: string } | null> {
  if (contentType === "song") {
    const [row] = await db.select({ artistId: songsTable.artistId }).from(songsTable).where(eq(songsTable.id, contentId)).limit(1);
    if (!row?.artistId) return null;
    const [artist] = await db.select({ userId: artistsTable.userId, stageName: artistsTable.stageName }).from(artistsTable).where(eq(artistsTable.id, row.artistId)).limit(1);
    if (!artist?.userId) return null;
    return { recipientUserId: artist.userId, creatorName: artist.stageName };
  }
  if (contentType === "video") {
    const [row] = await db.select({ artistId: videosTable.artistId }).from(videosTable).where(eq(videosTable.id, contentId)).limit(1);
    if (!row?.artistId) return null;
    const [artist] = await db.select({ userId: artistsTable.userId, stageName: artistsTable.stageName }).from(artistsTable).where(eq(artistsTable.id, row.artistId)).limit(1);
    if (!artist?.userId) return null;
    return { recipientUserId: artist.userId, creatorName: artist.stageName };
  }
  if (contentType === "artist") {
    const [artist] = await db.select({ userId: artistsTable.userId, stageName: artistsTable.stageName }).from(artistsTable).where(eq(artistsTable.id, contentId)).limit(1);
    if (!artist?.userId) return null;
    return { recipientUserId: artist.userId, creatorName: artist.stageName };
  }
  if (contentType === "label") {
    const [label] = await db.select({ userId: labelsTable.userId, name: labelsTable.name }).from(labelsTable).where(eq(labelsTable.id, contentId)).limit(1);
    if (!label) return null;
    return { recipientUserId: label.userId, creatorName: label.name };
  }
  if (contentType === "creator") {
    // Direct-to-profile tip: contentId IS the recipient's userId. This is how
    // staff-only accounts (admin/editor/moderator) — who have no artist/label
    // row — can receive tips once they enable Creator Support themselves.
    const [user] = await db.select({ id: usersTable.id, displayName: usersTable.displayName, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, contentId)).limit(1);
    if (!user) return null;
    return { recipientUserId: user.id, creatorName: user.displayName || user.username };
  }
  return null;
}

async function resolveContentTitle(contentType: string, contentId: number | null): Promise<string | null> {
  if (contentId === null) return null;
  if (contentType === "song") {
    const [row] = await db.select({ title: songsTable.title }).from(songsTable).where(eq(songsTable.id, contentId)).limit(1);
    return row?.title ?? null;
  }
  if (contentType === "video") {
    const [row] = await db.select({ title: videosTable.title }).from(videosTable).where(eq(videosTable.id, contentId)).limit(1);
    return row?.title ?? null;
  }
  if (contentType === "artist") {
    const [row] = await db.select({ name: artistsTable.stageName }).from(artistsTable).where(eq(artistsTable.id, contentId)).limit(1);
    return row?.name ?? null;
  }
  if (contentType === "label") {
    const [row] = await db.select({ name: labelsTable.name }).from(labelsTable).where(eq(labelsTable.id, contentId)).limit(1);
    return row?.name ?? null;
  }
  // "creator" tips are direct-to-profile, not tied to a specific content item.
  return null;
}

async function getFollowerStats(userId: number): Promise<{ followerCount: number; newFollowers30d: number }> {
  const [artist] = await db.select({ id: artistsTable.id }).from(artistsTable).where(eq(artistsTable.userId, userId)).limit(1);
  const [label] = await db.select({ id: labelsTable.id }).from(labelsTable).where(eq(labelsTable.userId, userId)).limit(1);

  const conditions = [];
  if (artist) conditions.push(and(eq(followsTable.targetType, "artist"), eq(followsTable.targetId, artist.id)));
  if (label) conditions.push(and(eq(followsTable.targetType, "label"), eq(followsTable.targetId, label.id)));
  if (conditions.length === 0) return { followerCount: 0, newFollowers30d: 0 };

  const whereClause = conditions.length === 1 ? conditions[0] : or(...conditions);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [[totalRow], [recentRow]] = await Promise.all([
    db.select({ count: count() }).from(followsTable).where(whereClause),
    db.select({ count: count() }).from(followsTable).where(and(whereClause, gte(followsTable.createdAt, thirtyDaysAgo))),
  ]);

  return { followerCount: totalRow?.count ?? 0, newFollowers30d: recentRow?.count ?? 0 };
}

async function getSupporterCount(recipientUserId: number): Promise<number> {
  const [row] = await db.select({ n: countDistinct(supportTransactionsTable.supporterUserId) })
    .from(supportTransactionsTable)
    .where(and(eq(supportTransactionsTable.recipientUserId, recipientUserId), eq(supportTransactionsTable.status, "completed")));
  return Number(row?.n ?? 0);
}

async function getContentSupporterCount(contentType: string, contentId: number): Promise<number> {
  const [row] = await db.select({ n: countDistinct(supportTransactionsTable.supporterUserId) })
    .from(supportTransactionsTable)
    .where(and(
      eq(supportTransactionsTable.contentType, contentType),
      eq(supportTransactionsTable.contentId, contentId),
      eq(supportTransactionsTable.status, "completed"),
    ));
  return Number(row?.n ?? 0);
}

function toActivityItem(r: {
  id: number; amount: string | number; currency: string; message: string | null;
  messageVisibility: string; moderationStatus: string; status: string;
  contentType: string; contentId: number | null; transactionRef: string; createdAt: Date;
  supporterDisplayName: string | null; supporterUsername: string;
}, contentTitle: string | null) {
  return {
    id: r.id,
    supporterDisplayName: r.supporterDisplayName || r.supporterUsername,
    amount: Number(r.amount),
    currency: r.currency,
    message: r.message,
    messageVisibility: r.messageVisibility,
    moderationStatus: r.moderationStatus,
    status: r.status,
    contentType: r.contentType,
    contentId: r.contentId,
    contentTitle,
    transactionRef: r.transactionRef,
    createdAt: r.createdAt,
  };
}

// ── Creator: own payment settings ──────────────────────────────────────────
router.get("/creator-support/settings", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [settings] = await db.select().from(creatorPaymentSettingsTable).where(eq(creatorPaymentSettingsTable.userId, req.user!.userId)).limit(1);
  res.json({
    supportEnabled: settings?.supportEnabled ?? false,
    provider: settings?.provider ?? "paypal",
    paypalEmail: settings?.paypalEmail ?? null,
    paypalMeLink: settings?.paypalMeLink ?? null,
    thankYouMessage: settings?.thankYouMessage ?? null,
    supportWallEnabled: settings?.supportWallEnabled ?? true,
    supportWallRequiresApproval: settings?.supportWallRequiresApproval ?? false,
  });
});

router.put("/creator-support/settings", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = UpdateCreatorSupportSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { supportEnabled, paypalEmail, paypalMeLink, thankYouMessage, supportWallEnabled, supportWallRequiresApproval } = parsed.data;
  const cleanEmail = paypalEmail?.trim() || null;
  const cleanLink = paypalMeLink?.trim() || null;
  const cleanThankYou = thankYouMessage?.trim() || null;

  if (supportEnabled && !cleanEmail && !cleanLink) {
    res.status(400).json({ error: "Add a PayPal email or PayPal.me link before enabling Creator Support." });
    return;
  }

  const [existing] = await db.select({ id: creatorPaymentSettingsTable.id }).from(creatorPaymentSettingsTable).where(eq(creatorPaymentSettingsTable.userId, req.user!.userId)).limit(1);

  const updateValues: Record<string, unknown> = {
    supportEnabled,
    paypalEmail: cleanEmail,
    paypalMeLink: cleanLink,
    thankYouMessage: cleanThankYou,
  };
  if (supportWallEnabled !== undefined) updateValues.supportWallEnabled = supportWallEnabled;
  if (supportWallRequiresApproval !== undefined) updateValues.supportWallRequiresApproval = supportWallRequiresApproval;

  const row = existing
    ? (await db.update(creatorPaymentSettingsTable).set(updateValues).where(eq(creatorPaymentSettingsTable.id, existing.id)).returning())[0]
    : (await db.insert(creatorPaymentSettingsTable).values({
        userId: req.user!.userId,
        supportEnabled,
        paypalEmail: cleanEmail,
        paypalMeLink: cleanLink,
        thankYouMessage: cleanThankYou,
        supportWallEnabled: supportWallEnabled ?? true,
        supportWallRequiresApproval: supportWallRequiresApproval ?? false,
      }).returning())[0];

  res.json({
    supportEnabled: row.supportEnabled,
    provider: row.provider,
    paypalEmail: row.paypalEmail,
    paypalMeLink: row.paypalMeLink,
    thankYouMessage: row.thankYouMessage,
    supportWallEnabled: row.supportWallEnabled,
    supportWallRequiresApproval: row.supportWallRequiresApproval,
  });
});

// ── Public-safe: check whether a user has Creator Support enabled ─────────
router.get("/creator-support/status/:userId", async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  if (isNaN(userId) || userId <= 0) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const queryParsed = GetCreatorSupportStatusQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }
  const { contentType, contentId } = queryParsed.data;

  const [settings] = await db.select({
    supportEnabled: creatorPaymentSettingsTable.supportEnabled,
    thankYouMessage: creatorPaymentSettingsTable.thankYouMessage,
    supportWallEnabled: creatorPaymentSettingsTable.supportWallEnabled,
  }).from(creatorPaymentSettingsTable).where(eq(creatorPaymentSettingsTable.userId, userId)).limit(1);

  const supporterCount = await getSupporterCount(userId);
  const contentSupporterCount = contentType && contentId !== undefined
    ? await getContentSupporterCount(contentType, contentId)
    : null;

  res.json({
    userId,
    supportEnabled: settings?.supportEnabled ?? false,
    supporterCount,
    contentSupporterCount,
    thankYouMessage: settings?.thankYouMessage ?? null,
    supportWallEnabled: settings?.supportWallEnabled ?? true,
  });
});

// ── Public: Support Wall (approved public/anonymous messages only) ────────
router.get("/creator-support/wall/:userId", async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  if (isNaN(userId) || userId <= 0) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const queryParsed = GetSupportWallQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }
  const { page, pageSize } = queryParsed.data;
  const offset = (page - 1) * pageSize;

  const whereClause = and(
    eq(supportTransactionsTable.recipientUserId, userId),
    eq(supportTransactionsTable.status, "completed"),
    eq(supportTransactionsTable.moderationStatus, "approved"),
    or(eq(supportTransactionsTable.messageVisibility, "public"), eq(supportTransactionsTable.messageVisibility, "anonymous")),
  );

  const [[totalRow], rows] = await Promise.all([
    db.select({ count: count() }).from(supportTransactionsTable).where(whereClause),
    db.select({
      id: supportTransactionsTable.id,
      messageVisibility: supportTransactionsTable.messageVisibility,
      message: supportTransactionsTable.message,
      contentType: supportTransactionsTable.contentType,
      contentId: supportTransactionsTable.contentId,
      createdAt: supportTransactionsTable.createdAt,
      supporterDisplayName: usersTable.displayName,
      supporterUsername: usersTable.username,
    }).from(supportTransactionsTable)
      .innerJoin(usersTable, eq(supportTransactionsTable.supporterUserId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(supportTransactionsTable.createdAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  const items = await Promise.all(rows.map(async (r) => {
    const isAnonymous = r.messageVisibility === "anonymous";
    return {
      id: r.id,
      isAnonymous,
      supporterDisplayName: isAnonymous ? null : (r.supporterDisplayName || r.supporterUsername),
      message: r.message,
      contentType: r.contentType,
      contentId: r.contentId,
      contentTitle: await resolveContentTitle(r.contentType, r.contentId),
      createdAt: r.createdAt,
    };
  }));

  const total = totalRow?.count ?? 0;
  res.json({ items, total, page, pageSize, hasMore: offset + items.length < total });
});

// ── Recipient: hide a public/anonymous message they received ──────────────
router.post("/creator-support/wall/:transactionId/hide", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const transactionId = Number(req.params.transactionId);
  if (isNaN(transactionId) || transactionId <= 0) {
    res.status(400).json({ error: "Invalid transaction id" });
    return;
  }
  const [tx] = await db.select().from(supportTransactionsTable).where(eq(supportTransactionsTable.id, transactionId)).limit(1);
  if (!tx) {
    res.status(404).json({ error: "Transaction not found." });
    return;
  }
  if (tx.recipientUserId !== req.user!.userId) {
    res.status(403).json({ error: "You can only hide messages you received." });
    return;
  }

  const [updated] = await db.update(supportTransactionsTable).set({ moderationStatus: "hidden" }).where(eq(supportTransactionsTable.id, transactionId)).returning();
  const [supporter] = await db.select({ displayName: usersTable.displayName, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, updated.supporterUserId)).limit(1);
  const contentTitle = await resolveContentTitle(updated.contentType, updated.contentId);

  res.json(toActivityItem({ ...updated, supporterDisplayName: supporter?.displayName ?? null, supporterUsername: supporter?.username ?? "A fan" }, contentTitle));
});

// ── Send a demo support tip ─────────────────────────────────────────────────
router.post("/creator-support/tips", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateSupportTipBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { contentType, contentId, amount, message, messageVisibility } = parsed.data;

  if (!SUPPORTABLE_TYPES.includes(contentType as SupportableType)) {
    res.status(400).json({ error: "Unsupported content type." });
    return;
  }
  if (contentId === undefined) {
    res.status(400).json({ error: "contentId is required." });
    return;
  }

  if (isRateLimited(req.user!.userId)) {
    res.status(429).json({ error: "Too many support attempts. Please wait a moment and try again." });
    return;
  }

  const recipient = await resolveSupportRecipient(contentType, contentId);
  if (!recipient) {
    res.status(404).json({ error: "Creator or content not found." });
    return;
  }

  if (recipient.recipientUserId === req.user!.userId) {
    res.status(400).json({ error: "You can't support yourself." });
    return;
  }

  const [settings] = await db.select({
    supportEnabled: creatorPaymentSettingsTable.supportEnabled,
    thankYouMessage: creatorPaymentSettingsTable.thankYouMessage,
    supportWallRequiresApproval: creatorPaymentSettingsTable.supportWallRequiresApproval,
  }).from(creatorPaymentSettingsTable).where(eq(creatorPaymentSettingsTable.userId, recipient.recipientUserId)).limit(1);
  if (!settings?.supportEnabled) {
    res.status(400).json({ error: "This creator hasn't enabled Creator Support." });
    return;
  }

  const moderationStatus = messageVisibility === "private"
    ? "approved"
    : (settings.supportWallRequiresApproval ? "pending" : "approved");

  let transaction;
  for (let attempt = 0; attempt < 5; attempt++) {
    const transactionRef = generateTransactionRef();
    try {
      [transaction] = await db.insert(supportTransactionsTable).values({
        supporterUserId: req.user!.userId,
        recipientUserId: recipient.recipientUserId,
        contentType,
        contentId,
        amount: amount.toFixed(2),
        currency: "USD",
        message: message?.trim() || null,
        messageVisibility,
        moderationStatus,
        transactionRef,
        provider: "paypal",
        mode: "demo",
        status: "completed",
      }).returning();
      break;
    } catch (err) {
      const code = err && typeof err === "object" ? (err as { code?: string }).code : undefined;
      if (code === "23505" && attempt < 4) continue;
      req.log.error({ err }, "Failed to create support transaction");
      res.status(500).json({ error: "Something went wrong sending your support. Please try again." });
      return;
    }
  }
  if (!transaction) {
    res.status(500).json({ error: "Something went wrong sending your support. Please try again." });
    return;
  }

  const [supporter] = await db.select({ displayName: usersTable.displayName, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  const supporterName = supporter?.displayName || supporter?.username || "A fan";

  await db.insert(notificationsTable).values({
    userId: recipient.recipientUserId,
    type: "general",
    title: "You received a demo tip! 💵",
    message: `${supporterName} sent you a $${Number(transaction.amount).toFixed(2)} demo tip${message?.trim() ? `: "${message.trim()}"` : "."}`,
    isRead: false,
  });

  try {
    await evaluateSupportBadges(req.user!.userId, recipient.recipientUserId);
  } catch (err) {
    req.log.error({ err }, "Failed to evaluate support badges");
  }

  req.log.info({ transactionRef: transaction.transactionRef, recipientUserId: recipient.recipientUserId, amount: transaction.amount }, "Demo support tip created");

  res.status(201).json({
    id: transaction.id,
    transactionRef: transaction.transactionRef,
    amount: Number(transaction.amount),
    currency: transaction.currency,
    message: transaction.message,
    messageVisibility: transaction.messageVisibility,
    mode: transaction.mode,
    status: transaction.status,
    createdAt: transaction.createdAt,
    thankYouMessage: settings.thankYouMessage ?? null,
  });
});

// ── Creator: own support analytics dashboard ───────────────────────────────
router.get("/creator-support/dashboard", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const creatorUserId = req.user!.userId;
  const completedFilter = eq(supportTransactionsTable.status, "completed");

  const [[clickRow], [attemptRow], [tipCountRow], [tipAmountRow], [pendingModerationRow], followerStats, supporterCount] = await Promise.all([
    db.select({ count: count() }).from(analyticsEventsTable).where(and(
      eq(analyticsEventsTable.eventName, "support_button_click"),
      eq(analyticsEventsTable.contentType, "user"),
      eq(analyticsEventsTable.contentId, creatorUserId),
    )),
    db.select({ count: count() }).from(analyticsEventsTable).where(and(
      eq(analyticsEventsTable.eventName, "support_tip_attempt"),
      eq(analyticsEventsTable.contentType, "user"),
      eq(analyticsEventsTable.contentId, creatorUserId),
    )),
    db.select({ count: count() }).from(supportTransactionsTable).where(and(eq(supportTransactionsTable.recipientUserId, creatorUserId), completedFilter)),
    db.select({ total: sql<number>`coalesce(sum(${supportTransactionsTable.amount}::numeric), 0)` }).from(supportTransactionsTable).where(and(eq(supportTransactionsTable.recipientUserId, creatorUserId), completedFilter)),
    db.select({ count: count() }).from(supportTransactionsTable).where(and(
      eq(supportTransactionsTable.recipientUserId, creatorUserId),
      completedFilter,
      eq(supportTransactionsTable.moderationStatus, "pending"),
    )),
    getFollowerStats(creatorUserId),
    getSupporterCount(creatorUserId),
  ]);

  const mostSupportedRaw = await db.select({
    contentType: supportTransactionsTable.contentType,
    contentId: supportTransactionsTable.contentId,
    totalAmount: sql<number>`coalesce(sum(${supportTransactionsTable.amount}::numeric), 0)`,
    tipCount: count(),
  }).from(supportTransactionsTable)
    .where(and(eq(supportTransactionsTable.recipientUserId, creatorUserId), completedFilter))
    .groupBy(supportTransactionsTable.contentType, supportTransactionsTable.contentId)
    .orderBy(desc(sql`sum(${supportTransactionsTable.amount}::numeric)`))
    .limit(5);

  const mostSupportedContent = await Promise.all(mostSupportedRaw.map(async (row) => ({
    contentType: row.contentType,
    contentId: row.contentId,
    title: (await resolveContentTitle(row.contentType, row.contentId)) ?? "Unknown content",
    totalAmount: Number(row.totalAmount),
    tipCount: Number(row.tipCount),
  })));

  const recentRaw = await db.select({
    id: supportTransactionsTable.id,
    amount: supportTransactionsTable.amount,
    currency: supportTransactionsTable.currency,
    message: supportTransactionsTable.message,
    messageVisibility: supportTransactionsTable.messageVisibility,
    moderationStatus: supportTransactionsTable.moderationStatus,
    status: supportTransactionsTable.status,
    contentType: supportTransactionsTable.contentType,
    contentId: supportTransactionsTable.contentId,
    transactionRef: supportTransactionsTable.transactionRef,
    createdAt: supportTransactionsTable.createdAt,
    supporterDisplayName: usersTable.displayName,
    supporterUsername: usersTable.username,
  }).from(supportTransactionsTable)
    .innerJoin(usersTable, eq(supportTransactionsTable.supporterUserId, usersTable.id))
    .where(eq(supportTransactionsTable.recipientUserId, creatorUserId))
    .orderBy(desc(supportTransactionsTable.createdAt))
    .limit(20);

  const recentActivity = await Promise.all(recentRaw.map(async (r) => toActivityItem(r, await resolveContentTitle(r.contentType, r.contentId))));

  const supportMessages = recentActivity.filter((a) => a.message && a.messageVisibility !== "private");

  res.json({
    mode: "demo",
    supportButtonClicks: clickRow?.count ?? 0,
    supportAttempts: attemptRow?.count ?? 0,
    totalDemoTips: tipCountRow?.count ?? 0,
    totalDemoAmount: Number(tipAmountRow?.total ?? 0),
    mostSupportedContent,
    recentActivity,
    supportMessages,
    followerCount: followerStats.followerCount,
    newFollowers30d: followerStats.newFollowers30d,
    pendingWallApprovalCount: pendingModerationRow?.count ?? 0,
    supporterCount,
  });
});

// ── Admin: platform-wide Creator Support overview ──────────────────────────
router.get("/admin/creator-support", requireAuth, requireRole(...ADMIN_ROLES), async (_req: AuthRequest, res): Promise<void> => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const completedFilter = eq(supportTransactionsTable.status, "completed");

  const [[attemptRow], [txCountRow], [txAmountRow], [newFollowersRow], [pendingModerationRow]] = await Promise.all([
    db.select({ count: count() }).from(analyticsEventsTable).where(eq(analyticsEventsTable.eventName, "support_tip_attempt")),
    db.select({ count: count() }).from(supportTransactionsTable).where(completedFilter),
    db.select({ total: sql<number>`coalesce(sum(${supportTransactionsTable.amount}::numeric), 0)` }).from(supportTransactionsTable).where(completedFilter),
    db.select({ count: count() }).from(followsTable).where(gte(followsTable.createdAt, thirtyDaysAgo)),
    db.select({ count: count() }).from(supportTransactionsTable).where(and(completedFilter, eq(supportTransactionsTable.moderationStatus, "pending"))),
  ]);

  const topCreatorsRaw = await db.select({
    recipientUserId: supportTransactionsTable.recipientUserId,
    totalAmount: sql<number>`coalesce(sum(${supportTransactionsTable.amount}::numeric), 0)`,
    tipCount: count(),
  }).from(supportTransactionsTable)
    .where(completedFilter)
    .groupBy(supportTransactionsTable.recipientUserId)
    .orderBy(desc(sql`sum(${supportTransactionsTable.amount}::numeric)`))
    .limit(10);

  const mostSupportedCreators = await Promise.all(topCreatorsRaw.map(async (row) => {
    const [u] = await db.select({ displayName: usersTable.displayName, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, row.recipientUserId)).limit(1);
    return {
      userId: row.recipientUserId,
      displayName: u?.displayName || u?.username || "Unknown",
      totalAmount: Number(row.totalAmount),
      tipCount: Number(row.tipCount),
    };
  }));

  async function topContentByType(type: string) {
    const rows = await db.select({
      contentId: supportTransactionsTable.contentId,
      totalAmount: sql<number>`coalesce(sum(${supportTransactionsTable.amount}::numeric), 0)`,
      tipCount: count(),
    }).from(supportTransactionsTable)
      .where(and(eq(supportTransactionsTable.contentType, type), completedFilter))
      .groupBy(supportTransactionsTable.contentId)
      .orderBy(desc(sql`sum(${supportTransactionsTable.amount}::numeric)`))
      .limit(10);
    return Promise.all(rows.map(async (r) => ({
      contentType: type,
      contentId: r.contentId,
      title: (await resolveContentTitle(type, r.contentId)) ?? "Unknown content",
      totalAmount: Number(r.totalAmount),
      tipCount: Number(r.tipCount),
    })));
  }

  const [mostSupportedSongs, mostSupportedVideos] = await Promise.all([
    topContentByType("song"),
    topContentByType("video"),
  ]);

  const topSupportersRaw = await db.select({
    supporterUserId: supportTransactionsTable.supporterUserId,
    totalAmount: sql<number>`coalesce(sum(${supportTransactionsTable.amount}::numeric), 0)`,
    tipCount: count(),
  }).from(supportTransactionsTable)
    .where(completedFilter)
    .groupBy(supportTransactionsTable.supporterUserId)
    .orderBy(desc(sql`sum(${supportTransactionsTable.amount}::numeric)`))
    .limit(10);

  const topSupporters = await Promise.all(topSupportersRaw.map(async (row) => {
    const [u] = await db.select({ displayName: usersTable.displayName, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, row.supporterUserId)).limit(1);
    return {
      userId: row.supporterUserId,
      displayName: u?.displayName || u?.username || "Unknown",
      totalAmount: Number(row.totalAmount),
      tipCount: Number(row.tipCount),
    };
  }));

  const recentRaw = await db.select({
    id: supportTransactionsTable.id,
    amount: supportTransactionsTable.amount,
    currency: supportTransactionsTable.currency,
    message: supportTransactionsTable.message,
    messageVisibility: supportTransactionsTable.messageVisibility,
    moderationStatus: supportTransactionsTable.moderationStatus,
    status: supportTransactionsTable.status,
    contentType: supportTransactionsTable.contentType,
    contentId: supportTransactionsTable.contentId,
    transactionRef: supportTransactionsTable.transactionRef,
    createdAt: supportTransactionsTable.createdAt,
    supporterDisplayName: usersTable.displayName,
    supporterUsername: usersTable.username,
  }).from(supportTransactionsTable)
    .innerJoin(usersTable, eq(supportTransactionsTable.supporterUserId, usersTable.id))
    .orderBy(desc(supportTransactionsTable.createdAt))
    .limit(20);

  const recentTransactions = await Promise.all(recentRaw.map(async (r) => toActivityItem(r, await resolveContentTitle(r.contentType, r.contentId))));

  const recentMessages = recentTransactions.filter((t) => t.message && t.messageVisibility !== "private");

  res.json({
    paymentMode: "demo",
    systemHealth: "operational",
    totalSupportAttempts: attemptRow?.count ?? 0,
    totalDemoTransactions: txCountRow?.count ?? 0,
    totalDemoAmount: Number(txAmountRow?.total ?? 0),
    mostSupportedCreators,
    mostSupportedSongs,
    mostSupportedVideos,
    topSupporters,
    newFollowers30d: newFollowersRow?.count ?? 0,
    recentTransactions,
    recentMessages,
    pendingModerationCount: pendingModerationRow?.count ?? 0,
  });
});

// ── Admin: override a demo transaction's status ────────────────────────────
router.put("/admin/creator-support/transactions/:id/status", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid transaction id" });
    return;
  }
  const parsed = UpdateSupportTransactionStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(supportTransactionsTable).where(eq(supportTransactionsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Transaction not found." });
    return;
  }

  const [updated] = await db.update(supportTransactionsTable).set({ status: parsed.data.status }).where(eq(supportTransactionsTable.id, id)).returning();

  await db.insert(adminAuditLogsTable).values({
    adminUserId: req.user!.userId,
    action: "support_transaction_status_update",
    targetType: "support_transaction",
    targetId: id,
    description: `Support transaction #${id} status updated to "${parsed.data.status}" (demo testing).`,
    metadata: { previousStatus: existing.status, newStatus: parsed.data.status } as unknown,
  });

  if (updated.status === "completed" && existing.status !== "completed") {
    try {
      await evaluateSupportBadges(updated.supporterUserId, updated.recipientUserId);
    } catch (err) {
      req.log.error({ err }, "Failed to evaluate support badges after status override");
    }
  }

  const [supporter] = await db.select({ displayName: usersTable.displayName, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, updated.supporterUserId)).limit(1);
  const contentTitle = await resolveContentTitle(updated.contentType, updated.contentId);
  res.json(toActivityItem({ ...updated, supporterDisplayName: supporter?.displayName ?? null, supporterUsername: supporter?.username ?? "A fan" }, contentTitle));
});

// ── Admin: approve/hide/restore a Support Wall message ─────────────────────
router.put("/admin/creator-support/wall/:id/moderation", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid transaction id" });
    return;
  }
  const parsed = UpdateSupportWallModerationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(supportTransactionsTable).where(eq(supportTransactionsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Transaction not found." });
    return;
  }

  const nextStatus = parsed.data.action === "hide" ? "hidden" : "approved";
  const [updated] = await db.update(supportTransactionsTable).set({ moderationStatus: nextStatus }).where(eq(supportTransactionsTable.id, id)).returning();

  await db.insert(adminAuditLogsTable).values({
    adminUserId: req.user!.userId,
    action: "support_wall_moderation",
    targetType: "support_transaction",
    targetId: id,
    description: `Support Wall message #${id} moderation set to "${nextStatus}" via "${parsed.data.action}" action.`,
    metadata: { previousModerationStatus: existing.moderationStatus, action: parsed.data.action } as unknown,
  });

  const [supporter] = await db.select({ displayName: usersTable.displayName, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, updated.supporterUserId)).limit(1);
  const contentTitle = await resolveContentTitle(updated.contentType, updated.contentId);
  res.json(toActivityItem({ ...updated, supporterDisplayName: supporter?.displayName ?? null, supporterUsername: supporter?.username ?? "A fan" }, contentTitle));
});

export default router;
