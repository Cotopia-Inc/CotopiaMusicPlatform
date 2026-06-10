import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, chatMessagesTable, usersTable, artistsTable } from "@workspace/db";
import { requireAuth, optionalAuth, type AuthRequest } from "../lib/auth";
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

  res.json(messages.reverse());
});

router.post("/chat/:contentType/:contentId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
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

export default router;
