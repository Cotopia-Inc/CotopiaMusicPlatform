import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, commentsTable } from "@workspace/db";
import { DeleteCommentParams } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.delete("/comments/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteCommentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [comment] = await db.select().from(commentsTable).where(eq(commentsTable.id, params.data.id)).limit(1);
  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  if (comment.userId !== req.user!.userId && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(commentsTable).where(eq(commentsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
