import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, userBlocksTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/users/blocks", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const blocks = await db
    .select({ blockedId: userBlocksTable.blockedId })
    .from(userBlocksTable)
    .where(eq(userBlocksTable.blockerId, userId));
  res.json(blocks.map(b => b.blockedId));
});

router.post("/users/block", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const { userId: targetId } = req.body as { userId: number };

  if (!targetId || targetId === userId) {
    res.status(400).json({ error: "Invalid user" });
    return;
  }

  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  await db.insert(userBlocksTable).values({ blockerId: userId, blockedId: targetId }).onConflictDoNothing();
  res.json({ success: true });
});

router.delete("/users/block/:userId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const targetId = parseInt(String(req.params["userId"] ?? "0"), 10);

  await db.delete(userBlocksTable).where(
    and(eq(userBlocksTable.blockerId, userId), eq(userBlocksTable.blockedId, targetId))
  );
  res.json({ success: true });
});

export default router;
