import { Router } from "express";
import { eq, or, and, desc, ne } from "drizzle-orm";
import { db, conversationsTable, directMessagesTable, usersTable, artistsTable, labelsTable, followsTable, userBlocksTable } from "@workspace/db";
import { notify } from "../lib/notify";
import { requireAuth, requireVerifiedEmail, type AuthRequest } from "../lib/auth";
import { count } from "drizzle-orm";

const router = Router();

// GET /messages — list conversations for current user (followed artists first, then by lastMessageAt)
router.get("/messages", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;

  const conversations = await db
    .select({
      id: conversationsTable.id,
      participant1Id: conversationsTable.participant1Id,
      participant2Id: conversationsTable.participant2Id,
      lastMessageAt: conversationsTable.lastMessageAt,
      createdAt: conversationsTable.createdAt,
      mutedByP1: conversationsTable.mutedByP1,
      mutedByP2: conversationsTable.mutedByP2,
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

    // Check if other user is an artist the current user follows (priority ordering)
    let isFollowedByMe = false;
    const [artistRow] = await db
      .select({ id: artistsTable.id })
      .from(artistsTable)
      .where(eq(artistsTable.userId, otherId))
      .limit(1);

    if (artistRow) {
      const [followRow] = await db
        .select({ id: followsTable.id })
        .from(followsTable)
        .where(and(
          eq(followsTable.followerId, userId),
          eq(followsTable.targetType, "artist"),
          eq(followsTable.targetId, artistRow.id),
        ))
        .limit(1);
      isFollowedByMe = !!followRow;
    }

    const isMuted = conv.participant1Id === userId ? conv.mutedByP1 : conv.mutedByP2;
    return {
      id: conv.id,
      otherUser: otherUser ?? null,
      lastMessage: lastMsg ?? null,
      unreadCount: unreadResult?.count ?? 0,
      lastMessageAt: conv.lastMessageAt,
      createdAt: conv.createdAt,
      isFollowedByMe,
      isMuted,
    };
  }));

  // Sort: followed first, then by lastMessageAt (already ordered by DB)
  enriched.sort((a, b) => {
    if (a.isFollowedByMe && !b.isFollowedByMe) return -1;
    if (!a.isFollowedByMe && b.isFollowedByMe) return 1;
    return 0;
  });

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
router.post("/messages", requireAuth, requireVerifiedEmail, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const senderRole = req.user!.role;
  const { toUserId, body } = req.body as { toUserId: number; body: string };

  if (!toUserId || !body?.trim()) { res.status(400).json({ error: "toUserId and body are required" }); return; }
  if (toUserId === userId) { res.status(400).json({ error: "Cannot message yourself" }); return; }

  const [targetUser] = await db
    .select({ id: usersTable.id, messagePolicy: usersTable.messagePolicy })
    .from(usersTable)
    .where(eq(usersTable.id, toUserId))
    .limit(1);
  if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }

  const [blockRow] = await db.select({ id: userBlocksTable.id }).from(userBlocksTable).where(
    or(
      and(eq(userBlocksTable.blockerId, userId), eq(userBlocksTable.blockedId, toUserId)),
      and(eq(userBlocksTable.blockerId, toUserId), eq(userBlocksTable.blockedId, userId))
    )
  ).limit(1);
  if (blockRow) { res.status(403).json({ error: "Cannot message this user" }); return; }

  // Enforce recipient's message policy on every send (staff bypass; existing threads also respect policy changes).
  const isStaff = ["master_admin", "admin", "editor", "moderator"].includes(senderRole);
  if (!isStaff) {
    const policy = targetUser.messagePolicy ?? "followers_only";
    if (policy === "nobody") {
      res.status(403).json({ error: "This user is not accepting messages" });
      return;
    }
    if (policy === "verified_only") {
      const [sender] = await db.select({ isVerified: usersTable.isVerified }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (!sender?.isVerified) {
        res.status(403).json({ error: "Only verified users can message this user" });
        return;
      }
    }
    if (policy === "followers_only") {
      // sender must follow the recipient's artist or label profile
      const recipientArtist = await db.select({ id: artistsTable.id }).from(artistsTable).where(eq(artistsTable.userId, toUserId));
      const recipientLabel = await db.select({ id: labelsTable.id }).from(labelsTable).where(eq(labelsTable.userId, toUserId));
      let follows = false;
      for (const a of recipientArtist) {
        const [f] = await db.select({ id: followsTable.id }).from(followsTable).where(and(eq(followsTable.followerId, userId), eq(followsTable.targetType, "artist"), eq(followsTable.targetId, a.id))).limit(1);
        if (f) { follows = true; break; }
      }
      if (!follows) {
        for (const l of recipientLabel) {
          const [f] = await db.select({ id: followsTable.id }).from(followsTable).where(and(eq(followsTable.followerId, userId), eq(followsTable.targetType, "label"), eq(followsTable.targetId, l.id))).limit(1);
          if (f) { follows = true; break; }
        }
      }
      if (!follows) {
        res.status(403).json({ error: "This user only accepts messages from followers" });
        return;
      }
    }
  }

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

  await notify({
    userId: toUserId,
    type: "message",
    title: `New message from ${sender?.username ?? "someone"}`,
    message: body.trim().length > 80 ? body.trim().slice(0, 80) + "…" : body.trim(),
    isRead: false,
  });

  res.status(201).json({ ...msg, conversationId: conv.id });
});

// PUT /messages/msg/:msgId — edit own message
router.put("/messages/msg/:msgId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const msgId = parseInt(String(req.params["msgId"] ?? "0"), 10);
  const { body } = req.body as { body: string };

  if (!body?.trim()) { res.status(400).json({ error: "body is required" }); return; }

  const [msg] = await db.select().from(directMessagesTable).where(eq(directMessagesTable.id, msgId)).limit(1);
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }
  if (msg.senderId !== userId) { res.status(403).json({ error: "Not your message" }); return; }

  const [updated] = await db.update(directMessagesTable)
    .set({ body: body.trim(), isEdited: true, editedAt: new Date() })
    .where(eq(directMessagesTable.id, msgId))
    .returning();

  res.json(updated);
});

// DELETE /messages/msg/:msgId — delete own message
router.delete("/messages/msg/:msgId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const msgId = parseInt(String(req.params["msgId"] ?? "0"), 10);

  const [msg] = await db.select().from(directMessagesTable).where(eq(directMessagesTable.id, msgId)).limit(1);
  if (!msg) { res.status(404).json({ error: "Message not found." }); return; }
  if (msg.senderId !== userId) { res.status(403).json({ error: "You can only delete your own messages." }); return; }

  await db.delete(directMessagesTable).where(eq(directMessagesTable.id, msgId));
  res.json({ success: true });
});

// PUT /messages/:id/mute — toggle mute for current user
router.put("/messages/:id/mute", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const convId = parseInt(String(req.params["id"] ?? "0"), 10);

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
  if (!conv) { res.status(404).json({ error: "Conversation not found." }); return; }
  if (conv.participant1Id !== userId && conv.participant2Id !== userId) {
    res.status(403).json({ error: "Not a participant" }); return;
  }

  const isP1 = conv.participant1Id === userId;
  const currentMuted = isP1 ? conv.mutedByP1 : conv.mutedByP2;

  if (isP1) {
    await db.update(conversationsTable).set({ mutedByP1: !currentMuted }).where(eq(conversationsTable.id, convId));
  } else {
    await db.update(conversationsTable).set({ mutedByP2: !currentMuted }).where(eq(conversationsTable.id, convId));
  }

  res.json({ isMuted: !currentMuted });
});

// PUT /messages/:id/read — mark all messages in conversation as read
router.put("/messages/:id/read", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const convId = parseInt(String(req.params["id"] ?? "0"), 10);

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
  if (!conv) { res.status(404).json({ error: "Conversation not found." }); return; }
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

// DELETE /messages/:id — delete conversation (removes messages + conversation record)
router.delete("/messages/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const convId = parseInt(String(req.params["id"] ?? "0"), 10);

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
  if (!conv) { res.status(404).json({ error: "Conversation not found." }); return; }
  if (conv.participant1Id !== userId && conv.participant2Id !== userId) {
    res.status(403).json({ error: "Not a participant" }); return;
  }

  await db.delete(directMessagesTable).where(eq(directMessagesTable.conversationId, convId));
  await db.delete(conversationsTable).where(eq(conversationsTable.id, convId));

  res.json({ success: true });
});

export default router;
