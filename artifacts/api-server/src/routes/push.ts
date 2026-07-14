import { Router } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.post("/push/subscribe", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { endpoint, keys } = req.body ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Invalid push subscription" });
    return;
  }
  await db
    .insert(pushSubscriptionsTable)
    .values({ userId: req.user!.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { userId: req.user!.userId, p256dh: keys.p256dh, auth: keys.auth },
    });
  res.json({ ok: true });
});

router.delete("/push/subscribe", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { endpoint } = req.body ?? {};
  if (!endpoint) { res.status(400).json({ error: "Missing endpoint" }); return; }
  await db
    .delete(pushSubscriptionsTable)
    .where(and(eq(pushSubscriptionsTable.endpoint, endpoint), eq(pushSubscriptionsTable.userId, req.user!.userId)));
  res.json({ ok: true });
});

export default router;
