import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, ilike, or, and, gt } from "drizzle-orm";
import { db, usersTable, artistsTable, labelsTable, emailOtpsTable, agreementAcceptancesTable, appSettingsTable } from "@workspace/db";
import { RegisterBody, LoginBody, UpdateMeBody, SendOtpBody, VerifyOtpBody, ChangePasswordBody, ChangeUsernameBody, SaveDemographicsBody } from "@workspace/api-zod";
import { signToken, requireAuth, type AuthRequest } from "../lib/auth";
import { Resend } from "resend";

const router = Router();

// ── OTP helper ─────────────────────────────────────────────────────────────
function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const resend = new Resend(process.env.RESEND_API_KEY);

const OTP_SUBJECTS: Record<string, string> = {
  verify_email: "Verify your Cotopia email",
  reset_password: "Reset your Cotopia password",
};

async function sendOtpEmail(to: string, code: string, purpose: string): Promise<void> {
  const subject = OTP_SUBJECTS[purpose] ?? "Your Cotopia code";
  const label = purpose === "reset_password" ? "password reset" : "email verification";
  try {
    await resend.emails.send({
      from: "Cotopia <onboarding@resend.dev>",
      to,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#f5f5f5;border-radius:12px">
          <div style="margin-bottom:24px">
            <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px">&#9678; Everyday Radio</span>
            <span style="font-size:11px;display:block;color:#888;margin-top:2px;letter-spacing:2px;text-transform:uppercase">by Cotopia</span>
          </div>
          <h2 style="font-size:20px;font-weight:700;margin:0 0 8px">Your ${label} code</h2>
          <p style="color:#aaa;margin:0 0 28px;font-size:14px">Use the code below to complete your ${label}. It expires in 10 minutes.</p>
          <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#a855f7">${code}</span>
          </div>
          <p style="color:#666;font-size:12px;margin:0">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[OTP EMAIL] Failed to send:", err);
  }
}

// ── Register ────────────────────────────────────────────────────────────────
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
    emailVerified: false,
  }).returning();

  // Create artist/label profile if applicable
  if (user.role === "artist") {
    await db.insert(artistsTable).values({ userId: user.id, stageName: user.displayName ?? user.username });
  } else if (user.role === "label") {
    await db.insert(labelsTable).values({ userId: user.id, name: user.displayName ?? user.username });
  }

  // Record agreement acceptances (ToS, Privacy, Community Guidelines, AI Policy)
  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null;
  const userAgent = req.headers["user-agent"] || null;
  await db.insert(agreementAcceptancesTable).values([
    { userId: user.id, agreementType: "terms", agreementVersion: "1.0", ipAddress, userAgent, metadata: { source: "registration" } },
    { userId: user.id, agreementType: "privacy", agreementVersion: "1.0", ipAddress, userAgent, metadata: { source: "registration" } },
    { userId: user.id, agreementType: "community_guidelines", agreementVersion: "1.0", ipAddress, userAgent, metadata: { source: "registration" } },
    { userId: user.id, agreementType: "ai_policy", agreementVersion: "1.0", ipAddress, userAgent, metadata: { source: "registration" } },
  ]);

  // Check if email verification is required by platform settings
  const [platformSettings] = await db.select({ requireEmailVerification: appSettingsTable.requireEmailVerification }).from(appSettingsTable).limit(1);
  const verificationRequired = platformSettings?.requireEmailVerification ?? true;

  let finalUser = user;
  if (verificationRequired) {
    // Issue and send email verification OTP
    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await db.insert(emailOtpsTable).values({ userId: user.id, email: user.email, code, purpose: "verify_email", expiresAt });
    await sendOtpEmail(user.email, code, "verify_email");
  } else {
    // Verification disabled — mark user as verified immediately
    const [updated] = await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, user.id)).returning();
    finalUser = updated;
  }

  const token = signToken({ userId: finalUser.id, role: finalUser.role });
  const { passwordHash: _, ...userOut } = finalUser;
  res.status(201).json({ user: userOut, token });
});

// ── Login (email OR username) ───────────────────────────────────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email: emailOrUsername, password } = parsed.data;

  // Try by email first, then by username
  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, emailOrUsername)).limit(1);
  if (!user) {
    [user] = await db.select().from(usersTable).where(eq(usersTable.username, emailOrUsername)).limit(1);
  }

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

// ── Get me ─────────────────────────────────────────────────────────────────
router.get("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const { passwordHash: _, ...userOut } = user;
  res.json(userOut);
});

// ── Update me ──────────────────────────────────────────────────────────────
router.patch("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, req.user!.userId)).returning();

  const needsArtistSync = parsed.data.bio !== undefined || parsed.data.bannerUrl !== undefined || parsed.data.avatarUrl !== undefined;
  const needsLabelSync = parsed.data.bio !== undefined || parsed.data.bannerUrl !== undefined;
  if (needsArtistSync || needsLabelSync) {
    if (user.role === "artist" && needsArtistSync) {
      const patch: Record<string, unknown> = {};
      if (parsed.data.bio !== undefined) patch["bio"] = parsed.data.bio;
      if (parsed.data.bannerUrl !== undefined) patch["bannerUrl"] = parsed.data.bannerUrl;
      if (parsed.data.avatarUrl !== undefined) patch["avatarUrl"] = parsed.data.avatarUrl;
      await db.update(artistsTable).set(patch as any).where(eq(artistsTable.userId, req.user!.userId));
    } else if (user.role === "label" && needsLabelSync) {
      const patch: Record<string, unknown> = {};
      if (parsed.data.bio !== undefined) patch["bio"] = parsed.data.bio;
      if (parsed.data.bannerUrl !== undefined) patch["bannerUrl"] = parsed.data.bannerUrl;
      await db.update(labelsTable).set(patch as any).where(eq(labelsTable.userId, req.user!.userId));
    }
  }

  const { passwordHash: _, ...userOut } = user;
  res.json(userOut);
});

// ── Send OTP ───────────────────────────────────────────────────────────────
router.post("/auth/send-otp", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = SendOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { purpose, newEmail } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Invalidate old OTPs for this user+purpose
  await db.update(emailOtpsTable).set({ used: true }).where(
    and(eq(emailOtpsTable.userId, user.id), eq(emailOtpsTable.purpose, purpose))
  );

  const targetEmail = purpose === "change_email" && newEmail ? newEmail : user.email;
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(emailOtpsTable).values({
    userId: user.id,
    email: targetEmail,
    code,
    purpose,
    newEmail: purpose === "change_email" ? newEmail ?? null : null,
    expiresAt,
  });

  await sendOtpEmail(targetEmail, code, purpose);
  res.json({ ok: true });
});

// ── Verify OTP ─────────────────────────────────────────────────────────────
router.post("/auth/verify-otp", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { code, purpose, newEmail } = parsed.data;

  const now = new Date();
  const [otp] = await db.select().from(emailOtpsTable).where(
    and(
      eq(emailOtpsTable.userId, req.user!.userId),
      eq(emailOtpsTable.code, code),
      eq(emailOtpsTable.purpose, purpose),
      eq(emailOtpsTable.used, false),
      gt(emailOtpsTable.expiresAt, now),
    )
  ).limit(1);

  if (!otp) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  // Mark as used
  await db.update(emailOtpsTable).set({ used: true }).where(eq(emailOtpsTable.id, otp.id));

  if (purpose === "verify_email") {
    await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, req.user!.userId));
  } else if (purpose === "change_email" && newEmail) {
    // Check email not in use by someone else
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, newEmail)).limit(1);
    if (existing && existing.id !== req.user!.userId) {
      res.status(400).json({ error: "Email already in use" });
      return;
    }
    await db.update(usersTable).set({ email: newEmail, emailVerified: true }).where(eq(usersTable.id, req.user!.userId));
  }

  res.json({ ok: true });
});

// ── Change password ────────────────────────────────────────────────────────
router.post("/auth/change-password", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, req.user!.userId));
  res.json({ ok: true });
});

// ── Change username ────────────────────────────────────────────────────────
router.post("/auth/change-username", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = ChangeUsernameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existing && existing.id !== req.user!.userId) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  const [user] = await db.update(usersTable).set({ username }).where(eq(usersTable.id, req.user!.userId)).returning();
  const { passwordHash: _, ...userOut } = user;
  res.json(userOut);
});

// ── Save demographics ──────────────────────────────────────────────────────
router.post("/auth/demographics", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = SaveDemographicsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.update(usersTable)
    .set({ ...parsed.data, demographicsCompleted: true })
    .where(eq(usersTable.id, req.user!.userId))
    .returning();

  const { passwordHash: _, ...userOut } = user;
  res.json(userOut);
});

// ── User search ────────────────────────────────────────────────────────────
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

// ── Get public user ────────────────────────────────────────────────────────
router.get("/users/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      bannerUrl: usersTable.bannerUrl,
      profileVideoUrl: usersTable.profileVideoUrl,
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
