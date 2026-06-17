import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, chatMessagesTable, usersTable, artistsTable } from "@workspace/db";
import { requireAuth, requireVerifiedEmail, optionalAuth, type AuthRequest } from "../lib/auth";
import { GetChatMessagesParams, PostChatMessageParams, PostChatMessageBody } from "@workspace/api-zod";

const router = Router();

router.get("/chat/:contentType/:contentId", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetChatMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const messages = await db
    .select({
      id: chatMessagesTable.id,
      userId: chatMessagesTable.userId,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      isVerified: usersTable.isVerified,
      role: usersTable.role,
      artistId: artistsTable.id,
      contentType: chatMessagesTable.contentType,
      contentId: chatMessagesTable.contentId,
      message: chatMessagesTable.message,
      createdAt: chatMessagesTable.createdAt,
    })
    .from(chatMessagesTable)
    .innerJoin(usersTable, eq(chatMessagesTable.userId, usersTable.id))
    .leftJoin(artistsTable, eq(artistsTable.userId, usersTable.id))
    .where(
      and(
        eq(chatMessagesTable.contentType, params.data.contentType),
        eq(chatMessagesTable.contentId, params.data.contentId),
      ),
    )
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(limit);

  const seen = new Set<number>();
  const deduped = messages.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
  res.json(deduped.reverse());
});

router.post("/chat/:contentType/:contentId", requireAuth, requireVerifiedEmail, async (req: AuthRequest, res): Promise<void> => {
  const params = PostChatMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const body = PostChatMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [inserted] = await db
    .insert(chatMessagesTable)
    .values({
      userId: req.user!.userId,
      contentType: params.data.contentType,
      contentId: params.data.contentId,
      message: body.data.message,
    })
    .returning();

  const [userRow] = await db
    .select({
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      isVerified: usersTable.isVerified,
      artistId: artistsTable.id,
    })
    .from(usersTable)
    .leftJoin(artistsTable, eq(artistsTable.userId, usersTable.id))
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);

  res.status(201).json({
    id: inserted.id,
    userId: inserted.userId,
    username: userRow.username,
    avatarUrl: userRow.avatarUrl,
    isVerified: userRow.isVerified,
    role: req.user!.role,
    artistId: userRow.artistId ?? null,
    contentType: inserted.contentType,
    contentId: inserted.contentId,
    message: inserted.message,
    createdAt: inserted.createdAt,
  });
});

router.delete("/chat/msg/:msgId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const msgId = parseInt(String(req.params["msgId"] ?? "0"), 10);

  const [msg] = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.id, msgId)).limit(1);
  if (!msg) { res.status(404).json({ error: "Not found" }); return; }
  if (msg.userId !== userId) { res.status(403).json({ error: "Not your message" }); return; }

  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.id, msgId));
  res.json({ success: true });
});

export default router;
