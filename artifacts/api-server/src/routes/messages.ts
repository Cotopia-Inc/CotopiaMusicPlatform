import { Router } from "express";
import { eq, or, and, desc, ne } from "drizzle-orm";
import { db, conversationsTable, directMessagesTable, usersTable, notificationsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { count } from "drizzle-orm";

const router = Router();

// GET /messages — list conversations for current user
router.get("/messages", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;

  const conversations = await db
    .select({
      id: conversationsTable.id,
      participant1Id: conversationsTable.participant1Id,
      participant2Id: conversationsTable.participant2Id,
      lastMessageAt: conversationsTable.lastMessageAt,
      createdAt: conversationsTable.createdAt,
    })
    .from(conversationsTable)
    .where(or(eq(conversationsTable.participant1Id, userId), eq(conversationsTable.participant2Id, userId)))
    .orderBy(desc(conversationsTable.lastMessageAt));

  const enriched = await Promise.all(conversations.map(async (conv) => {
    const otherId = conv.participant1Id === userId ? conv.participant2Id : conv.participant1Id;

    const [otherUser] = await db
      .select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl, role: usersTable.role, isVerified: usersTable.isVerified })
      .from(usersTable)
      .where(eq(usersTable.id, otherId))
      .limit(1);

    const [lastMsg] = await db
      .select({ id: directMessagesTable.id, body: directMessagesTable.body, senderId: directMessagesTable.senderId, isRead: directMessagesTable.isRead, createdAt: directMessagesTable.createdAt })
      .from(directMessagesTable)
      .where(eq(directMessagesTable.conversationId, conv.id))
      .orderBy(desc(directMessagesTable.createdAt))
      .limit(1);

    const [unreadResult] = await db
      .select({ count: count() })
      .from(directMessagesTable)
      .where(and(
        eq(directMessagesTable.conversationId, conv.id),
        eq(directMessagesTable.isRead, false),
        ne(directMessagesTable.senderId, userId),
      ));

    return {
      id: conv.id,
      otherUser: otherUser ?? null,
      lastMessage: lastMsg ?? null,
      unreadCount: unreadResult?.count ?? 0,
      lastMessageAt: conv.lastMessageAt,
      createdAt: conv.createdAt,
    };
  }));

  res.json(enriched);
});

// GET /messages/unread-count
router.get("/messages/unread-count", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;

  const conversations = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(or(eq(conversationsTable.participant1Id, userId), eq(conversationsTable.participant2Id, userId)));

  let total = 0;
  for (const conv of conversations) {
    const [r] = await db
      .select({ count: count() })
      .from(directMessagesTable)
      .where(and(
        eq(directMessagesTable.conversationId, conv.id),
        eq(directMessagesTable.isRead, false),
        ne(directMessagesTable.senderId, userId),
      ));
    total += r?.count ?? 0;
  }

  res.json({ count: total });
});

// GET /messages/:id — get messages in a conversation
router.get("/messages/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const convId = parseInt(String(req.params["id"] ?? "0"), 10);

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
  if (conv.participant1Id !== userId && conv.participant2Id !== userId) {
    res.status(403).json({ error: "Not a participant" }); return;
  }

  const messages = await db
    .select({
      id: directMessagesTable.id,
      conversationId: directMessagesTable.conversationId,
      senderId: directMessagesTable.senderId,
      body: directMessagesTable.body,
      isRead: directMessagesTable.isRead,
      createdAt: directMessagesTable.createdAt,
      senderUsername: usersTable.username,
      senderDisplayName: usersTable.displayName,
      senderAvatarUrl: usersTable.avatarUrl,
      senderRole: usersTable.role,
      senderIsVerified: usersTable.isVerified,
    })
    .from(directMessagesTable)
    .leftJoin(usersTable, eq(directMessagesTable.senderId, usersTable.id))
    .where(eq(directMessagesTable.conversationId, convId))
    .orderBy(directMessagesTable.createdAt);

  res.json(messages);
});

// POST /messages — send DM (finds or creates conversation)
router.post("/messages", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const { toUserId, body } = req.body as { toUserId: number; body: string };

  if (!toUserId || !body?.trim()) { res.status(400).json({ error: "toUserId and body are required" }); return; }
  if (toUserId === userId) { res.status(400).json({ error: "Cannot message yourself" }); return; }

  const [targetUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, toUserId)).limit(1);
  if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }

  const p1 = Math.min(userId, toUserId);
  const p2 = Math.max(userId, toUserId);

  let [conv] = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.participant1Id, p1), eq(conversationsTable.participant2Id, p2)))
    .limit(1);

  if (!conv) {
    const [newConv] = await db.insert(conversationsTable).values({ participant1Id: p1, participant2Id: p2 }).returning();
    conv = newConv!;
  }

  const [msg] = await db.insert(directMessagesTable).values({
    conversationId: conv.id,
    senderId: userId,
    body: body.trim(),
    isRead: false,
  }).returning();

  await db.update(conversationsTable).set({ lastMessageAt: new Date() }).where(eq(conversationsTable.id, conv.id));

  const [sender] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  await db.insert(notificationsTable).values({
    userId: toUserId,
    type: "message",
    title: `New message from ${sender?.username ?? "someone"}`,
    message: body.trim().length > 80 ? body.trim().slice(0, 80) + "…" : body.trim(),
    isRead: false,
  });

  res.status(201).json({ ...msg, conversationId: conv.id });
});

// PUT /messages/:id/read — mark all messages in conversation as read
router.put("/messages/:id/read", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const convId = parseInt(String(req.params["id"] ?? "0"), 10);

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  if (conv.participant1Id !== userId && conv.participant2Id !== userId) {
    res.status(403).json({ error: "Not a participant" }); return;
  }

  const result = await db.update(directMessagesTable)
    .set({ isRead: true })
    .where(and(
      eq(directMessagesTable.conversationId, convId),
      eq(directMessagesTable.isRead, false),
      ne(directMessagesTable.senderId, userId),
    ));

  res.json({ updated: result.rowCount ?? 0 });
});

export default router;
