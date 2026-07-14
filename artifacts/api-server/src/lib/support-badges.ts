import { eq, and, countDistinct } from "drizzle-orm";
import { db, badgesTable, userBadgesTable, supportTransactionsTable } from "@workspace/db";
import { notify } from "./notify";

// Auto-award engine for the Creator Support badge ladder. Runs after every
// completed demo tip. Idempotent (INSERT ... ON CONFLICT DO NOTHING against
// the user_badges (userId, badgeId) unique constraint) so re-running never
// double-awards. Thresholds are based purely on DISTINCT counterparty counts
// (never dollar amounts) — real, never inflated.
//
// Badge names below MUST match the exact rows seeded in scripts/src/seed.ts.
// "Support Champion" and "Creator Champion" were seeded before this spec and
// are reused as the top tier here (no renames) to avoid duplicate badges.
const CREATOR_TIERS = [
  { name: "Fan Supported Creator", minDistinctSupporters: 1 },
  { name: "Community Favorite", minDistinctSupporters: 5 },
  { name: "Rising Creator", minDistinctSupporters: 15 },
  { name: "Founding Creator", minDistinctSupporters: 30 },
  { name: "Creator Champion", minDistinctSupporters: 50 },
] as const;

const SUPPORTER_TIERS = [
  { name: "First Supporter", minDistinctCreators: 1 },
  { name: "Community Supporter", minDistinctCreators: 3 },
  { name: "Founding Supporter", minDistinctCreators: 5 },
  { name: "Top Supporter", minDistinctCreators: 10 },
  { name: "Support Champion", minDistinctCreators: 20 },
] as const;

async function awardBadgeIfMissing(userId: number, badgeName: string): Promise<boolean> {
  const [badge] = await db.select({ id: badgesTable.id, description: badgesTable.description }).from(badgesTable).where(eq(badgesTable.name, badgeName)).limit(1);
  if (!badge) return false;

  const inserted = await db.insert(userBadgesTable).values({
    userId,
    badgeId: badge.id,
    awardedByAdminId: null,
    reason: "Automatically awarded by the Creator Support system.",
  }).onConflictDoNothing({ target: [userBadgesTable.userId, userBadgesTable.badgeId] }).returning({ id: userBadgesTable.id });

  return inserted.length > 0;
}

async function notifyBadgeAwarded(userId: number, badgeName: string): Promise<void> {
  await notify({
    userId,
    type: "general",
    title: "New badge earned! 🏅",
    message: `You earned the "${badgeName}" badge.`,
    isRead: false,
  });
}

// Evaluates and awards any newly-qualified badges for both sides of a
// completed support transaction. Safe to call multiple times (idempotent).
export async function evaluateSupportBadges(supporterUserId: number, recipientUserId: number): Promise<void> {
  const [[supporterStats], [recipientStats]] = await Promise.all([
    db.select({ distinctCreators: countDistinct(supportTransactionsTable.recipientUserId) })
      .from(supportTransactionsTable)
      .where(and(eq(supportTransactionsTable.supporterUserId, supporterUserId), eq(supportTransactionsTable.status, "completed"))),
    db.select({ distinctSupporters: countDistinct(supportTransactionsTable.supporterUserId) })
      .from(supportTransactionsTable)
      .where(and(eq(supportTransactionsTable.recipientUserId, recipientUserId), eq(supportTransactionsTable.status, "completed"))),
  ]);

  const distinctCreators = Number(supporterStats?.distinctCreators ?? 0);
  const distinctSupporters = Number(recipientStats?.distinctSupporters ?? 0);

  const supporterAwards = SUPPORTER_TIERS.filter((t) => distinctCreators >= t.minDistinctCreators);
  const creatorAwards = CREATOR_TIERS.filter((t) => distinctSupporters >= t.minDistinctSupporters);

  for (const tier of supporterAwards) {
    const awarded = await awardBadgeIfMissing(supporterUserId, tier.name);
    if (awarded) await notifyBadgeAwarded(supporterUserId, tier.name);
  }
  for (const tier of creatorAwards) {
    const awarded = await awardBadgeIfMissing(recipientUserId, tier.name);
    if (awarded) await notifyBadgeAwarded(recipientUserId, tier.name);
  }
}
