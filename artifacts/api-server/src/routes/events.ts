import { Router } from "express";
import { eq, asc, and } from "drizzle-orm";
import { db, eventsTable, creatorMessageTable } from "@workspace/db";
import {
  GetUserEventsParams, CreateEventBody, UpdateEventParams, UpdateEventBody, DeleteEventParams,
  GetCreatorMessageParams, SetCreatorMessageBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/users/:id/events", async (req, res): Promise<void> => {
  const params = GetUserEventsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const events = await db.select().from(eventsTable)
    .where(eq(eventsTable.userId, params.data.id))
    .orderBy(asc(eventsTable.eventDate));
  res.json(events);
});

router.post("/events", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [event] = await db.insert(eventsTable)
    .values({ ...parsed.data, userId: req.user!.userId })
    .returning();
  res.status(201).json(event);
});

router.patch("/events/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.id)).limit(1);
  if (!existing || existing.userId !== req.user!.userId) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const [event] = await db.update(eventsTable)
    .set(parsed.data)
    .where(eq(eventsTable.id, params.data.id))
    .returning();
  res.json(event);
});

router.delete("/events/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.id)).limit(1);
  if (!existing || existing.userId !== req.user!.userId) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  await db.delete(eventsTable).where(eq(eventsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/users/:id/creator-message", async (req, res): Promise<void> => {
  const params = GetCreatorMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(creatorMessageTable).where(eq(creatorMessageTable.userId, params.data.id)).limit(1);
  if (!existing) {
    res.json({ id: 0, userId: params.data.id, content: "", authorTitle: "Creator", isVisible: false, updatedAt: new Date().toISOString() });
    return;
  }
  res.json(existing);
});

router.put("/creator-message", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = SetCreatorMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(creatorMessageTable)
    .where(eq(creatorMessageTable.userId, req.user!.userId)).limit(1);
  if (existing) {
    const [updated] = await db.update(creatorMessageTable)
      .set(parsed.data)
      .where(eq(creatorMessageTable.userId, req.user!.userId))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(creatorMessageTable)
      .values({ ...parsed.data, userId: req.user!.userId })
      .returning();
    res.json(created);
  }
});

export default router;
