import { Router } from "express";
import { eq, and, ne, desc, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, badgesTable, userBadgesTable, usersTable, notificationsTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthRequest } from "../lib/auth";

const router = Router();

const ADMIN_ROLES = ["admin", "master_admin"] as const;

const CATEGORY_PRIORITY: Record<string, number> = {
  admin: 0,
  community: 1,
  creator: 2,
  beta: 3,
  achievement: 4,
};

function primaryBadgeSort(a: { category: string }, b: { category: string }) {
  return (CATEGORY_PRIORITY[a.category] ?? 99) - (CATEGORY_PRIORITY[b.category] ?? 99);
}

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

  const adminUser = alias(usersTable, "admin_user");

  const rows = await db
    .select({
      id: userBadgesTable.id,
      userId: userBadgesTable.userId,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      badgeId: userBadgesTable.badgeId,
      awardedByAdminId: userBadgesTable.awardedByAdminId,
      awardedByUsername: adminUser.username,
      isFeatured: userBadgesTable.isFeatured,
      featureOrder: userBadgesTable.featureOrder,
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
    .leftJoin(adminUser, eq(userBadgesTable.awardedByAdminId, adminUser.id))
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
    awardedByUsername: r.awardedByUsername ?? null,
    isFeatured: r.isFeatured,
    featureOrder: r.featureOrder,
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

// ── Authenticated: update featured badges ───────────────────────────────────
router.put("/users/:id/featured-badges", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid user id" }); return; }

  // Only the user themselves (or admin) can update their featured badges
  if (req.user!.userId !== id && !["admin", "master_admin"].includes(req.user!.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { badgeIds } = req.body as { badgeIds?: number[] };
  if (!Array.isArray(badgeIds)) {
    res.status(400).json({ error: "badgeIds must be an array of badge ids" }); return;
  }

  // Verify user owns all those badges
  const owned = await db
    .select({ id: userBadgesTable.id, badgeId: userBadgesTable.badgeId })
    .from(userBadgesTable)
    .where(and(
      eq(userBadgesTable.userId, id),
      badgeIds.length > 0 ? inArray(userBadgesTable.badgeId, badgeIds) : sql`false`,
    ));

  if (badgeIds.length > 0 && owned.length !== badgeIds.length) {
    res.status(400).json({ error: "One or more badges not owned by this user" }); return;
  }

  const ownedBadgeIds = owned.map(o => o.badgeId);

  // Clear all featured for this user first
  await db.update(userBadgesTable)
    .set({ isFeatured: false, featureOrder: null })
    .where(eq(userBadgesTable.userId, id));

  // Set featured for the requested ones
  for (let i = 0; i < badgeIds.length; i++) {
    await db.update(userBadgesTable)
      .set({ isFeatured: true, featureOrder: i + 1 })
      .where(and(eq(userBadgesTable.userId, id), eq(userBadgesTable.badgeId, badgeIds[i])));
  }

  res.json({ featuredBadgeIds: badgeIds, message: "Featured badges updated" });
  void ownedBadgeIds;
});

// ── Admin: list all badges (including inactive) ───────────────────────────
router.get("/admin/badges", requireAuth, requireRole(...ADMIN_ROLES), async (_req, res): Promise<void> => {
  const badges = await db.select().from(badgesTable).orderBy(badgesTable.name);
  res.json(badges);
});

// ── Admin: create badge ────────────────────────────────────────────────────
router.post("/admin/badges", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  try {
    const { name, description, category, icon, color, isVisible, isActive } = req.body as Record<string, unknown>;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Badge name is required." }); return;
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      res.status(400).json({ error: "A description is required." }); return;
    }

    // Check for duplicate name
    const [existing] = await db.select({ id: badgesTable.id }).from(badgesTable).where(eq(badgesTable.name, String(name).trim())).limit(1);
    if (existing) { res.status(409).json({ error: `A badge named "${String(name).trim()}" already exists. Please choose a different name.` }); return; }

    const [badge] = await db.insert(badgesTable).values({
      name: String(name).trim(),
      description: String(description).trim(),
      category: typeof category === "string" ? category : "achievement",
      icon: typeof icon === "string" && icon.trim() ? icon.trim() : "🏆",
      color: typeof color === "string" && color.trim() ? color.trim() : null,
      isVisible: typeof isVisible === "boolean" ? isVisible : true,
      isActive: typeof isActive === "boolean" ? isActive : true,
    }).returning();

    res.status(201).json(badge);
  } catch (err) {
    const code = err && typeof err === "object" ? (err as { code?: string }).code : undefined;
    req.log.error({ err, code }, "Failed to create badge");
    if (code === "23505") {
      res.status(409).json({ error: "A badge with that name already exists. Please choose a different name." });
      return;
    }
    if (code === "23502") {
      res.status(400).json({ error: "A required badge field is missing. Please fill in all fields and try again." });
      return;
    }
    res.status(500).json({ error: "Something went wrong while saving the badge. Please try again.", code });
  }
});

// ── Admin: delete badge ────────────────────────────────────────────────────
router.delete("/admin/badges/:id", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid badge id." }); return; }

  const [badge] = await db.select({ id: badgesTable.id, name: badgesTable.name }).from(badgesTable).where(eq(badgesTable.id, id)).limit(1);
  if (!badge) { res.status(404).json({ error: "Badge not found." }); return; }

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(userBadgesTable)
    .where(eq(userBadgesTable.badgeId, id));

  await db.delete(badgesTable).where(eq(badgesTable.id, id));
  req.log.info({ badgeId: id, badgeName: badge.name, revokedFromUsers: count, adminId: req.user!.userId }, "Badge deleted by admin");
  res.json({ deleted: true, name: badge.name, revokedFromUsers: Number(count) });
});

// ── Admin: update badge ────────────────────────────────────────────────────
router.patch("/admin/badges/:id", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid badge id." }); return; }

    const { name, description, category, icon, color, isVisible, isActive } = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) { res.status(400).json({ error: "Badge name cannot be empty." }); return; }
      // Check for duplicate name (excluding current badge)
      const [dup] = await db.select({ id: badgesTable.id }).from(badgesTable)
        .where(and(eq(badgesTable.name, String(name).trim()), ne(badgesTable.id, id))).limit(1);
      if (dup) { res.status(409).json({ error: `A badge named "${String(name).trim()}" already exists. Please choose a different name.` }); return; }
      patch.name = String(name).trim();
    }
    if (description !== undefined) patch.description = String(description).trim();
    if (category !== undefined) patch.category = category;
    if (icon !== undefined && typeof icon === "string" && icon.trim()) patch.icon = icon.trim();
    if (color !== undefined && typeof color === "string") patch.color = color.trim() ? color.trim() : null;
    if (isVisible !== undefined) patch.isVisible = isVisible;
    if (isActive !== undefined) patch.isActive = isActive;

    const [updated] = await db.update(badgesTable).set(patch).where(eq(badgesTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Badge not found." }); return; }
    res.json(updated);
  } catch (err) {
    const code = err && typeof err === "object" ? (err as { code?: string }).code : undefined;
    req.log.error({ err, code }, "Failed to update badge");
    if (code === "23505") {
      res.status(409).json({ error: "A badge with that name already exists. Please choose a different name." });
      return;
    }
    if (code === "23502") {
      res.status(400).json({ error: "A required badge field is missing. Please fill in all fields and try again." });
      return;
    }
    res.status(500).json({ error: "Something went wrong while saving the badge. Please try again.", code });
  }
});

// ── Admin: list all user badge awards ─────────────────────────────────────
router.get("/admin/user-badges", requireAuth, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res): Promise<void> => {
  const userIdFilter = req.query.userId ? Number(req.query.userId) : null;

  const adminUser = alias(usersTable, "admin_user");

  const rows = await db
    .select({
      id: userBadgesTable.id,
      userId: userBadgesTable.userId,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      badgeId: userBadgesTable.badgeId,
      awardedByAdminId: userBadgesTable.awardedByAdminId,
      awardedByUsername: adminUser.username,
      isFeatured: userBadgesTable.isFeatured,
      featureOrder: userBadgesTable.featureOrder,
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
    .leftJoin(adminUser, eq(userBadgesTable.awardedByAdminId, adminUser.id))
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
    awardedByUsername: r.awardedByUsername ?? null,
    isFeatured: r.isFeatured,
    featureOrder: r.featureOrder,
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

  // Check for duplicate
  const [dupe] = await db.select({ id: userBadgesTable.id }).from(userBadgesTable)
    .where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.badgeId, badgeId))).limit(1);
  if (dupe) { res.status(409).json({ error: "User already has this badge" }); return; }

  const adminUser = alias(usersTable, "admin_user");
  const [award] = await db.insert(userBadgesTable).values({
    userId,
    badgeId,
    awardedByAdminId: req.user!.userId,
    reason: reason?.trim() || null,
  }).returning();

  const [adminRow] = await db.select({ username: adminUser.username }).from(adminUser).where(eq(adminUser.id, req.user!.userId)).limit(1);

  await db.insert(notificationsTable).values({
    userId,
    type: "badge_awarded",
    title: `${badge.icon} You've earned a badge!`,
    message: `You've been awarded the "${badge.name}" badge.${reason?.trim() ? ` Reason: ${reason.trim()}` : ""}`,
    isRead: false,
  });

  res.status(201).json({
    id: award.id,
    userId: award.userId,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    badgeId: award.badgeId,
    awardedByAdminId: award.awardedByAdminId,
    awardedByUsername: adminRow?.username ?? null,
    isFeatured: award.isFeatured,
    featureOrder: award.featureOrder,
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

export { primaryBadgeSort };

// ── Auto-award helper (used by auth.ts and submissions.ts) ─────────────────
export async function awardBadgeByName(userId: number, badgeName: string, options?: { awardedByAdminId?: number | null; reason?: string }): Promise<void> {
  const [badge] = await db.select({ id: badgesTable.id }).from(badgesTable).where(and(eq(badgesTable.name, badgeName), eq(badgesTable.isActive, true))).limit(1);
  if (!badge) return;

  // Idempotent: don't award the same badge twice
  const [existing] = await db.select({ id: userBadgesTable.id }).from(userBadgesTable).where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.badgeId, badge.id))).limit(1);
  if (existing) return;

  const [fullBadge] = await db.select({ name: badgesTable.name, icon: badgesTable.icon }).from(badgesTable).where(eq(badgesTable.id, badge.id)).limit(1);

  await db.insert(userBadgesTable).values({
    userId,
    badgeId: badge.id,
    awardedByAdminId: options?.awardedByAdminId ?? null,
    reason: options?.reason ?? null,
  });

  if (fullBadge) {
    await db.insert(notificationsTable).values({
      userId,
      type: "badge_awarded",
      title: `${fullBadge.icon} You've earned a badge!`,
      message: `You've been awarded the "${fullBadge.name}" badge.${options?.reason ? ` Reason: ${options.reason}` : ""}`,
      isRead: false,
    });
  }
}

// ── Helper: get primary badge for multiple users ───────────────────────────
export async function getPrimaryBadgesForUsers(userIds: number[]): Promise<Map<number, { id: number; name: string; icon: string; color: string | null; category: string }>> {
  if (userIds.length === 0) return new Map();

  const rows = await db
    .select({
      userId: userBadgesTable.userId,
      badgeId: badgesTable.id,
      name: badgesTable.name,
      icon: badgesTable.icon,
      color: badgesTable.color,
      category: badgesTable.category,
    })
    .from(userBadgesTable)
    .innerJoin(badgesTable, eq(userBadgesTable.badgeId, badgesTable.id))
    .where(and(
      inArray(userBadgesTable.userId, userIds),
      eq(badgesTable.isActive, true),
      eq(badgesTable.isVisible, true),
    ));

  const result = new Map<number, { id: number; name: string; icon: string; color: string | null; category: string }>();
  for (const row of rows) {
    const existing = result.get(row.userId);
    if (!existing || primaryBadgeSort(row, existing) < 0) {
      result.set(row.userId, { id: row.badgeId, name: row.name, icon: row.icon, color: row.color, category: row.category });
    }
  }
  return result;
}
