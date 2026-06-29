import { Router } from "express";
import { eq, and, desc, or } from "drizzle-orm";
import { db, chatMessagesTable, usersTable, artistsTable, userBlocksTable, videosTable, songsTable } from "@workspace/db";
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

  // Block enforcement: if the content creator has blocked the sender (or vice-versa), deny chat access.
  const senderId = req.user!.userId;
  const contentId = params.data.contentId;
  const contentType = params.data.contentType;

  if (contentType === "video" || contentType === "song") {
    let creatorUserId: number | null = null;
    if (contentType === "video") {
      const [row] = await db
        .select({ userId: artistsTable.userId })
        .from(videosTable)
        .innerJoin(artistsTable, eq(videosTable.artistId, artistsTable.id))
        .where(eq(videosTable.id, contentId))
        .limit(1);
      creatorUserId = row?.userId ?? null;
    } else {
      const [row] = await db
        .select({ userId: artistsTable.userId })
        .from(songsTable)
        .innerJoin(artistsTable, eq(songsTable.artistId, artistsTable.id))
        .where(eq(songsTable.id, contentId))
        .limit(1);
      creatorUserId = row?.userId ?? null;
    }
    if (creatorUserId && creatorUserId !== senderId) {
      const [block] = await db
        .select({ id: userBlocksTable.id })
        .from(userBlocksTable)
        .where(or(
          and(eq(userBlocksTable.blockerId, senderId), eq(userBlocksTable.blockedId, creatorUserId)),
          and(eq(userBlocksTable.blockerId, creatorUserId), eq(userBlocksTable.blockedId, senderId)),
        ))
        .limit(1);
      if (block) {
        res.status(403).json({ error: "You cannot post in this chat." });
        return;
      }
    }
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

router.put("/chat/msg/:msgId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const msgId = parseInt(String(req.params["msgId"] ?? "0"), 10);
  const { message } = req.body as { message?: string };

  if (!message?.trim()) { res.status(400).json({ error: "message is required" }); return; }

  const [existing] = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.id, msgId)).limit(1);
  if (!existing) { res.status(404).json({ error: "Item not found." }); return; }
  if (existing.userId !== userId) { res.status(403).json({ error: "Not your message" }); return; }

  const [updated] = await db
    .update(chatMessagesTable)
    .set({ message: message.trim() })
    .where(eq(chatMessagesTable.id, msgId))
    .returning();

  res.json(updated);
});

router.delete("/chat/msg/:msgId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const msgId = parseInt(String(req.params["msgId"] ?? "0"), 10);

  const [msg] = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.id, msgId)).limit(1);
  if (!msg) { res.status(404).json({ error: "Item not found." }); return; }
  if (msg.userId !== userId) { res.status(403).json({ error: "Not your message" }); return; }

  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.id, msgId));
  res.json({ success: true });
});

export default router;
