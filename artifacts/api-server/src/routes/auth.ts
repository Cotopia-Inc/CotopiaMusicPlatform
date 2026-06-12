import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, ilike, or } from "drizzle-orm";
import { db, usersTable, artistsTable, labelsTable } from "@workspace/db";
import { RegisterBody, LoginBody, UpdateMeBody } from "@workspace/api-zod";
import { signToken, requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password, username, displayName, role } = parsed.data;

  const existingEmail = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existingEmail.length > 0) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const existingUsername = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existingUsername.length > 0) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    email,
    passwordHash,
    username,
    displayName: displayName ?? null,
    role: role ?? "listener",
  }).returning();

  // Create artist/label profile if applicable
  if (user.role === "artist") {
    await db.insert(artistsTable).values({ userId: user.id, stageName: user.displayName ?? user.username });
  } else if (user.role === "label") {
    await db.insert(labelsTable).values({ userId: user.id, name: user.displayName ?? user.username });
  }

  const token = signToken({ userId: user.id, role: user.role });
  const { passwordHash: _, ...userOut } = user;
  res.status(201).json({ user: userOut, token });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Account is deactivated" });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role });
  const { passwordHash: _, ...userOut } = user;
  res.status(200).json({ user: userOut, token });
});

router.post("/auth/logout", (_req, res): void => {
  res.status(200).json({ ok: true });
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const { passwordHash: _, ...userOut } = user;
  res.json(userOut);
});

router.patch("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, req.user!.userId)).returning();
  const { passwordHash: _, ...userOut } = user;
  res.json(userOut);
});

router.get("/users/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  if (!q || q.length < 2) { res.json([]); return; }
  const results = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    displayName: usersTable.displayName,
    avatarUrl: usersTable.avatarUrl,
    role: usersTable.role,
    isVerified: usersTable.isVerified,
  }).from(usersTable).where(or(
    ilike(usersTable.username, `%${q}%`),
    ilike(usersTable.displayName, `%${q}%`),
  )).limit(20);
  res.json(results);
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      bio: usersTable.bio,
      role: usersTable.role,
      isVerified: usersTable.isVerified,
      createdAt: usersTable.createdAt,
      artistId: artistsTable.id,
    })
    .from(usersTable)
    .leftJoin(artistsTable, eq(artistsTable.userId, usersTable.id))
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!row) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ ...row, artistId: row.artistId ?? null });
});

export default router;
