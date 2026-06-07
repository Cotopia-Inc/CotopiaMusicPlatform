import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
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

export default router;
