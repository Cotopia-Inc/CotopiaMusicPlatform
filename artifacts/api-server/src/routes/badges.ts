import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, badgesTable, userBadgesTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthRequest } from "../lib/auth";

const router = Router();

const ADMIN_ROLES = ["admin", "master_admin"] as const;

// ── Public: list all active, visible badges ───────────────────────────────
router.get("/badges", async (_req, res): Promise<void> => {
  const badges = await db
    .select()
    .from(badgesTable)
    .where(and(eq(badgesTable.isActive, true), eq(badgesTable.isVisible, true)))
    .orderBy(badgesTable.name);
  res.json(badges);
});

// ── Public: get a user's badges ────────────────────────────────────────────
router.get("/users/:id/badges", async (req, res, next): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) { next(); return; }

  const admin1 = usersTable;
  const rows = await db
    .select({
      id: userBadgesTable.id,
      userId: userBadgesTable.userId,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      badgeId: userBadgesTable.badgeId,
      awardedByAdminId: userBadgesTable.awardedByAdminId,
      reason: userBadgesTable.reason,
      awardedAt: userBadgesTable.awardedAt,
      badgeName: badgesTable.name,
      badgeDescription: badgesTable.description,
      badgeCategory: badgesTable.category,
      badgeIcon: badgesTable.icon,
      badgeColor: badgesTable.color,
      badgeIsVisible: badgesTable.isVisible,
      badgeIsActive: badgesTable.isActive,
      badgeCreatedAt: badgesTable.createdAt,
      badgeUpdatedAt: badgesTable.updatedAt,
    })
    .from(userBadgesTable)
    .innerJoin(usersTable, eq(userBadgesTable.userId, usersTable.id))
    .innerJoin(badgesTable, eq(userBadgesTable.badgeId, badgesTable.id))
    .where(and(eq(userBadgesTable.userId, id), eq(badgesTable.isActive, true)))
    .orderBy(desc(userBadgesTable.awardedAt));

  res.json(rows.map(r => ({
    id: r.id,
    userId: r.userId,
    username: r.username,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    badgeId: r.badgeId,
    awardedByAdminId: r.awardedByAdminId,
    awardedByUsername: null,
    reason: r.reason,
    awardedAt: r.awardedAt,
    badge: {
      id: r.badgeId,
      name: r.badgeName,
      description: r.badgeDescription,
      category: r.badgeCategory,
      icon: r.badgeIcon,
      color: r.badgeColor,
      isVisible: r.badgeIsVisible,
      isActive: r.badgeIsActive,
      createdAt: r.badgeCreatedAt,
      updatedAt: r.badgeUpdatedAt,
    },
  })));
});

// ── Admin: list all badges (including inactive) ───────────────────────────
router.get("/admin/badges", requireAuth, requireRole(...ADMIN_ROLES), async (_req, res): Promise<void> => {
  const badges = await db.select().from(badgesTable).orderBy(badgesTable.name);
  res.json(badges);
});

// ── Admin: create badge ────────────────────────────────────────────────────
router.post("/admin/badges", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const { name, description, category, icon, color, isVisible, isActive } = req.body as Record<string, unknown>;

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Badge name is required" }); return;
  }
  if (!description || typeof description !== "string" || !description.trim()) {
    res.status(400).json({ error: "Badge description is required" }); return;
  }

  const [badge] = await db.insert(badgesTable).values({
    name: String(name).trim(),
    description: String(description).trim(),
    category: typeof category === "string" ? category : "achievement",
    icon: typeof icon === "string" ? icon : "🏆",
    color: typeof color === "string" ? color : "#7c3aed",
    isVisible: typeof isVisible === "boolean" ? isVisible : true,
    isActive: typeof isActive === "boolean" ? isActive : true,
  }).returning();

  res.status(201).json(badge);
});

// ── Admin: update badge ────────────────────────────────────────────────────
router.patch("/admin/badges/:id", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid badge id" }); return; }

  const { name, description, category, icon, color, isVisible, isActive } = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (description !== undefined) patch.description = String(description).trim();
  if (category !== undefined) patch.category = category;
  if (icon !== undefined) patch.icon = icon;
  if (color !== undefined) patch.color = color;
  if (isVisible !== undefined) patch.isVisible = isVisible;
  if (isActive !== undefined) patch.isActive = isActive;

  const [updated] = await db.update(badgesTable).set(patch).where(eq(badgesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Badge not found" }); return; }
  res.json(updated);
});

// ── Admin: list all user badge awards ─────────────────────────────────────
router.get("/admin/user-badges", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const userIdFilter = req.query.userId ? Number(req.query.userId) : null;

  const adminAlias = db.select({
    id: usersTable.id,
    username: usersTable.username,
  }).from(usersTable).as("admin_user");

  const rows = await db
    .select({
      id: userBadgesTable.id,
      userId: userBadgesTable.userId,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      badgeId: userBadgesTable.badgeId,
      awardedByAdminId: userBadgesTable.awardedByAdminId,
      reason: userBadgesTable.reason,
      awardedAt: userBadgesTable.awardedAt,
      badgeName: badgesTable.name,
      badgeDescription: badgesTable.description,
      badgeCategory: badgesTable.category,
      badgeIcon: badgesTable.icon,
      badgeColor: badgesTable.color,
      badgeIsVisible: badgesTable.isVisible,
      badgeIsActive: badgesTable.isActive,
      badgeCreatedAt: badgesTable.createdAt,
      badgeUpdatedAt: badgesTable.updatedAt,
    })
    .from(userBadgesTable)
    .innerJoin(usersTable, eq(userBadgesTable.userId, usersTable.id))
    .innerJoin(badgesTable, eq(userBadgesTable.badgeId, badgesTable.id))
    .where(userIdFilter ? eq(userBadgesTable.userId, userIdFilter) : undefined)
    .orderBy(desc(userBadgesTable.awardedAt));

  res.json(rows.map(r => ({
    id: r.id,
    userId: r.userId,
    username: r.username,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    badgeId: r.badgeId,
    awardedByAdminId: r.awardedByAdminId,
    awardedByUsername: null,
    reason: r.reason,
    awardedAt: r.awardedAt,
    badge: {
      id: r.badgeId,
      name: r.badgeName,
      description: r.badgeDescription,
      category: r.badgeCategory,
      icon: r.badgeIcon,
      color: r.badgeColor,
      isVisible: r.badgeIsVisible,
      isActive: r.badgeIsActive,
      createdAt: r.badgeCreatedAt,
      updatedAt: r.badgeUpdatedAt,
    },
  })));
});

// ── Admin: assign badge to user ────────────────────────────────────────────
router.post("/admin/user-badges", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const { userId, badgeId, reason } = req.body as { userId?: number; badgeId?: number; reason?: string };

  if (!userId || !badgeId) {
    res.status(400).json({ error: "userId and badgeId are required" }); return;
  }

  const [user] = await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [badge] = await db.select().from(badgesTable).where(eq(badgesTable.id, badgeId)).limit(1);
  if (!badge) { res.status(404).json({ error: "Badge not found" }); return; }

  const [award] = await db.insert(userBadgesTable).values({
    userId,
    badgeId,
    awardedByAdminId: req.user!.userId,
    reason: reason?.trim() || null,
  }).returning();

  res.status(201).json({
    id: award.id,
    userId: award.userId,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    badgeId: award.badgeId,
    awardedByAdminId: award.awardedByAdminId,
    awardedByUsername: null,
    reason: award.reason,
    awardedAt: award.awardedAt,
    badge,
  });
});

// ── Admin: remove badge from user ──────────────────────────────────────────
router.delete("/admin/user-badges/:id", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select({ id: userBadgesTable.id }).from(userBadgesTable).where(eq(userBadgesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Award not found" }); return; }

  await db.delete(userBadgesTable).where(eq(userBadgesTable.id, id));
  res.status(204).send();
});

export default router;

// ── Auto-award helper (used by auth.ts and submissions.ts) ─────────────────
export async function awardBadgeByName(userId: number, badgeName: string, options?: { awardedByAdminId?: number | null; reason?: string }): Promise<void> {
  const [badge] = await db.select({ id: badgesTable.id }).from(badgesTable).where(and(eq(badgesTable.name, badgeName), eq(badgesTable.isActive, true))).limit(1);
  if (!badge) return;

  // Idempotent: don't award the same badge twice
  const [existing] = await db.select({ id: userBadgesTable.id }).from(userBadgesTable).where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.badgeId, badge.id))).limit(1);
  if (existing) return;

  await db.insert(userBadgesTable).values({
    userId,
    badgeId: badge.id,
    awardedByAdminId: options?.awardedByAdminId ?? null,
    reason: options?.reason ?? null,
  });
}
