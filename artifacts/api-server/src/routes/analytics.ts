import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, analyticsEventsTable, artistsTable, usersTable } from "@workspace/db";
import { optionalAuth, requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.post("/analytics/events", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const { eventType, eventName, contentType, contentId, metadata } = req.body as {
    eventType?: string;
    eventName?: string;
    contentType?: string;
    contentId?: number;
    metadata?: Record<string, unknown>;
  };

  if (!eventType || !eventName) {
    res.status(400).json({ error: "eventType and eventName are required" });
    return;
  }

  await db.insert(analyticsEventsTable).values({
    eventType,
    eventName,
    userId: req.user?.userId ?? null,
    contentType: contentType ?? null,
    contentId: contentId ?? null,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });

  res.json({ ok: true });
});

export default router;
