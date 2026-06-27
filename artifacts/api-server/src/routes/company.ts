import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, companyPostsTable, ceoMessageTable } from "@workspace/db";
import {
  ListCompanyPostsQueryParams, CreateCompanyPostBody, GetCompanyPostParams,
  UpdateCompanyPostParams, UpdateCompanyPostBody, DeleteCompanyPostParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole, type AuthRequest } from "../lib/auth";
import { z } from "zod";

const router = Router();

router.get("/company/posts", async (req, res): Promise<void> => {
  const params = ListCompanyPostsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { type, limit = 20 } = params.data;

  const conditions = type ? [eq(companyPostsTable.type, type)] : [];
  const posts = await db.select().from(companyPostsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(companyPostsTable.isPinned), desc(companyPostsTable.createdAt))
    .limit(limit);

  res.json(posts);
});

router.post("/company/posts", requireAuth, requireRole("admin", "master_admin"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateCompanyPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [post] = await db.insert(companyPostsTable).values({ ...parsed.data, authorId: req.user!.userId }).returning();
  res.status(201).json(post);
});

router.get("/company/posts/:id", async (req, res): Promise<void> => {
  const params = GetCompanyPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [post] = await db.select().from(companyPostsTable).where(eq(companyPostsTable.id, params.data.id)).limit(1);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(post);
});

router.patch("/company/posts/:id", requireAuth, requireRole("admin", "master_admin"), async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateCompanyPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCompanyPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [post] = await db.update(companyPostsTable).set(parsed.data).where(eq(companyPostsTable.id, params.data.id)).returning();
  res.json(post);
});

router.delete("/company/posts/:id", requireAuth, requireRole("admin", "master_admin"), async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteCompanyPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(companyPostsTable).where(eq(companyPostsTable.id, params.data.id));
  res.sendStatus(204);
});

const CeoMessageInput = z.object({
  content: z.string(),
  authorName: z.string().default("CEO"),
  authorTitle: z.string().default("Chief Executive Officer"),
  isVisible: z.boolean(),
});

router.get("/ceo-message", async (_req, res): Promise<void> => {
  const rows = await db.select().from(ceoMessageTable).limit(1);
  if (!rows[0]) {
    const [created] = await db.insert(ceoMessageTable).values({ content: "", authorName: "CEO", authorTitle: "Chief Executive Officer", isVisible: false }).returning();
    res.json(created);
    return;
  }
  res.json(rows[0]);
});

router.put("/ceo-message", requireAuth, requireRole("master_admin"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = CeoMessageInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(ceoMessageTable).limit(1);
  if (existing[0]) {
    const [updated] = await db.update(ceoMessageTable)
      .set({ ...parsed.data, updatedBy: req.user!.userId })
      .where(eq(ceoMessageTable.id, existing[0].id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(ceoMessageTable)
      .values({ ...parsed.data, updatedBy: req.user!.userId })
      .returning();
    res.json(created);
  }
});

export default router;
