import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { eq, ilike, or, and, gt, sql } from "drizzle-orm";
import { db, usersTable, artistsTable, labelsTable, emailOtpsTable, agreementAcceptancesTable, appSettingsTable, followsTable, userBlocksTable } from "@workspace/db";
import { RegisterBody, LoginBody, UpdateMeBody, SendOtpBody, VerifyOtpBody, ChangePasswordBody, ChangeUsernameBody, SaveDemographicsBody } from "@workspace/api-zod";
import { signToken, requireAuth, optionalAuth, type AuthRequest } from "../lib/auth";
import { count } from "drizzle-orm";
import { logger } from "../lib/logger";
import { Resend } from "resend";
import { awardBadgeByName } from "./badges";

const BETA_END_DATE = new Date("2026-12-31T23:59:59Z");

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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === "re_placeholder") {
    logger.warn("[OTP EMAIL] RESEND_API_KEY not configured — skipping email send");
    return;
  }
  const subject = OTP_SUBJECTS[purpose] ?? "Your Cotopia code";
  const label = purpose === "reset_password" ? "password reset" : "email verification";
  const fromAddress = process.env.FROM_EMAIL ?? "Cotopia <noreply@cotopia.org>";
  try {
    await resend.emails.send({
      from: fromAddress,
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
    logger.error({ err }, "[OTP EMAIL] Failed to send");
  }
}

// ── Register ────────────────────────────────────────────────────────────────
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password, username, displayName, role, ageConfirmed } = parsed.data;

  if (ageConfirmed !== true) {
    res.status(400).json({ error: "You must confirm you meet the age requirement to register." });
    return;
  }

  const existingEmail = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existingEmail.length > 0) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const existingUsername = await db.select().from(usersTable).where(ilike(usersTable.username, username)).limit(1);
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
    { userId: user.id, agreementType: "content_license", agreementVersion: "1.0", ipAddress, userAgent, metadata: { source: "registration" } },
    { userId: user.id, agreementType: "age_confirmation", agreementVersion: "1.0", ipAddress, userAgent, metadata: { source: "registration", statement: "Confirmed at least 18 years old or the age of legal majority in their jurisdiction, whichever is greater." } },
  ]);

  // Check if email verification is required by platform settings
  const [platformSettings] = await db.select({ requireEmailVerification: appSettingsTable.requireEmailVerification }).from(appSettingsTable).limit(1);
  const verificationRequired = platformSettings?.requireEmailVerification ?? true;

  let finalUser = user;
  if (!verificationRequired) {
    // Verification disabled — mark user as verified immediately
    const [updated] = await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, user.id)).returning();
    finalUser = updated;
  }
  // When verification is required, the verify-email page sends the OTP on mount — no dupe here.

  // Auto-award Founding Member badge during beta window
  if (new Date() <= BETA_END_DATE) {
    awardBadgeByName(finalUser.id, "Founding Member", { reason: "Joined during the founding beta period" })
      .catch(err => logger.error(err, "Failed to auto-award Founding Member badge"));
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

  if (user.isBanned) {
    res.status(403).json({ error: "Your account has been permanently banned." });
    return;
  }

  if (user.isSuspended) {
    const expiry = user.suspendedUntil ? new Date(user.suspendedUntil) : null;
    if (expiry && expiry.getTime() <= Date.now()) {
      // Temporary suspension has expired — auto-lift it.
      await db.update(usersTable).set({ isSuspended: false, suspendedUntil: null }).where(eq(usersTable.id, user.id));
      user.isSuspended = false;
      user.suspendedUntil = null;
    } else {
      const until = expiry ? ` until ${expiry.toISOString().slice(0, 10)}` : "";
      res.status(403).json({ error: `Your account is suspended${until}.` });
      return;
    }
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

  const needsArtistSync = parsed.data.displayName !== undefined || parsed.data.bio !== undefined || parsed.data.bannerUrl !== undefined || parsed.data.avatarUrl !== undefined;
  const needsLabelSync = parsed.data.displayName !== undefined || parsed.data.bio !== undefined || parsed.data.bannerUrl !== undefined || parsed.data.avatarUrl !== undefined;
  if (needsArtistSync || needsLabelSync) {
    if (user.role === "artist" && needsArtistSync) {
      const patch: Record<string, unknown> = {};
      if (parsed.data.displayName !== undefined) patch["stageName"] = parsed.data.displayName;
      if (parsed.data.bio !== undefined) patch["bio"] = parsed.data.bio;
      if (parsed.data.bannerUrl !== undefined) patch["bannerUrl"] = parsed.data.bannerUrl;
      if (parsed.data.avatarUrl !== undefined) patch["avatarUrl"] = parsed.data.avatarUrl;
      await db.update(artistsTable).set(patch as any).where(eq(artistsTable.userId, req.user!.userId));
    } else if (user.role === "label" && needsLabelSync) {
      const patch: Record<string, unknown> = {};
      if (parsed.data.displayName !== undefined) patch["name"] = parsed.data.displayName;
      if (parsed.data.bio !== undefined) patch["bio"] = parsed.data.bio;
      if (parsed.data.bannerUrl !== undefined) patch["bannerUrl"] = parsed.data.bannerUrl;
      if (parsed.data.avatarUrl !== undefined) patch["logoUrl"] = parsed.data.avatarUrl;
      await db.update(labelsTable).set(patch as any).where(eq(labelsTable.userId, req.user!.userId));
    }
  }

  // Auto-award "Profile Complete" badge when bio + avatarUrl + displayName are all present
  if (user.bio && user.avatarUrl && user.displayName) {
    awardBadgeByName(user.id, "Profile Complete", { reason: "Completed full profile" })
      .catch(err => logger.error(err, "Failed to auto-award Profile Complete badge"));
  }

  const { passwordHash: _, ...userOut } = user;
  res.json(userOut);
});

// ── Request account deletion ────────────────────────────────────────────────
router.post("/auth/me/deletion-request", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  await db.update(usersTable).set({ deletionRequestedAt: new Date() }).where(eq(usersTable.id, req.user!.userId));
  res.json({ ok: true });
});

// ── Cancel account deletion request ─────────────────────────────────────────
router.delete("/auth/me/deletion-request", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  await db.update(usersTable).set({ deletionRequestedAt: null }).where(eq(usersTable.id, req.user!.userId));
  res.json({ ok: true });
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

  // Fire-and-forget — respond immediately, don't block on email delivery
  sendOtpEmail(targetEmail, code, purpose).catch(() => {});
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

  const [existing] = await db.select().from(usersTable).where(ilike(usersTable.username, username)).limit(1);
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

// ── Public platform config ─────────────────────────────────────────────────
router.get("/platform-config", async (_req, res): Promise<void> => {
  const [s] = await db
    .select({
      requireEmailVerification: appSettingsTable.requireEmailVerification,
      singleSongFee: appSettingsTable.singleSongFee,
      batchSongFee: appSettingsTable.batchSongFee,
      premiumSongFee: appSettingsTable.premiumSongFee,
      singleVideoFee: appSettingsTable.singleVideoFee,
      batchVideoFee: appSettingsTable.batchVideoFee,
      premiumVideoFee: appSettingsTable.premiumVideoFee,
      maintenanceMode: appSettingsTable.maintenanceMode,
    })
    .from(appSettingsTable)
    .limit(1);
  res.json({
    requireEmailVerification: s?.requireEmailVerification ?? true,
    singleSongFee: parseFloat(s?.singleSongFee ?? "9.99"),
    batchSongFee: parseFloat(s?.batchSongFee ?? "19.99"),
    premiumSongFee: parseFloat(s?.premiumSongFee ?? "49.99"),
    singleVideoFee: parseFloat(s?.singleVideoFee ?? "14.99"),
    batchVideoFee: parseFloat(s?.batchVideoFee ?? "29.99"),
    premiumVideoFee: parseFloat(s?.premiumVideoFee ?? "79.99"),
    maintenanceMode: s?.maintenanceMode ?? false,
  });
});

// ── User search ────────────────────────────────────────────────────────────
router.get("/users/search", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  if (!q || q.length < 2) { res.json([]); return; }

  const isAdmin = req.user?.role && ["admin", "master_admin", "editor", "moderator"].includes(req.user.role);

  const conditions = [
    ilike(usersTable.username, `%${q}%`),
    ilike(usersTable.displayName, `%${q}%`),
    ...(isAdmin ? [ilike(usersTable.email, `%${q}%`)] : []),
  ];

  const results = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    displayName: usersTable.displayName,
    avatarUrl: usersTable.avatarUrl,
    role: usersTable.role,
    isVerified: usersTable.isVerified,
  }).from(usersTable).where(or(...conditions)).limit(20);
  res.json(results);
});

// ── Forgot password ────────────────────────────────────────────────────────
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { identifier } = req.body ?? {};
  if (!identifier || typeof identifier !== "string") {
    res.json({ ok: true }); // always succeed to prevent enumeration
    return;
  }

  // Look up by email first, then username
  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, identifier.trim())).limit(1);
  if (!user) {
    [user] = await db.select().from(usersTable).where(eq(usersTable.username, identifier.trim())).limit(1);
  }

  // Always return success even if account not found
  if (!user || !user.email) { res.json({ ok: true }); return; }

  // Invalidate any existing unused reset tokens for this user
  await db.update(emailOtpsTable)
    .set({ used: true })
    .where(and(eq(emailOtpsTable.userId, user.id), eq(emailOtpsTable.purpose, "reset_password"), eq(emailOtpsTable.used, false)));

  // Generate a secure 64-char hex token
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(emailOtpsTable).values({
    userId: user.id,
    email: user.email,
    code: token,
    purpose: "reset_password",
    expiresAt,
  });

  // Build reset URL from the request host
  const proto = req.headers["x-forwarded-proto"] ?? req.protocol ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.get("host") ?? "";
  const siteUrl = process.env.SITE_URL ?? `${proto}://${host}`;
  const resetUrl = `${siteUrl}/reset-password?token=${token}`;

  // Send the recovery email
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && apiKey !== "re_placeholder") {
    const fromAddress = process.env.FROM_EMAIL ?? "Cotopia <noreply@cotopia.org>";
    const displayName = user.displayName ?? user.username;
    try {
      await resend.emails.send({
        from: fromAddress,
        to: user.email,
        subject: "Recover your Everyday Radio account",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#f5f5f5;border-radius:12px">
            <div style="margin-bottom:24px">
              <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px">&#9678; Everyday Radio</span>
              <span style="font-size:11px;display:block;color:#888;margin-top:2px;letter-spacing:2px;text-transform:uppercase">by Cotopia</span>
            </div>
            <h2 style="font-size:20px;font-weight:700;margin:0 0 8px">Account recovery</h2>
            <p style="color:#aaa;margin:0 0 20px;font-size:14px">Hi <strong style="color:#f5f5f5">${displayName}</strong>, here's your account info:</p>
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:16px 20px;margin-bottom:20px">
              <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px">Your username</p>
              <p style="margin:0;font-size:22px;font-weight:800;color:#a855f7">@${user.username}</p>
            </div>
            <p style="color:#aaa;margin:0 0 16px;font-size:14px">To reset your password, click the button below. This link expires in <strong style="color:#f5f5f5">1 hour</strong>.</p>
            <a href="${resetUrl}" style="display:block;background:#a855f7;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:8px;font-weight:700;font-size:15px;margin-bottom:20px">
              Reset my password →
            </a>
            <p style="color:#555;font-size:12px;margin:0;word-break:break-all">Or copy this link: ${resetUrl}</p>
            <hr style="border:none;border-top:1px solid #222;margin:24px 0" />
            <p style="color:#555;font-size:12px;margin:0">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
          </div>
        `,
      });
    } catch (err) {
      logger.error({ err }, "[RESET EMAIL] Failed to send");
    }
  } else {
    logger.warn({ resetUrl }, "[RESET EMAIL] RESEND_API_KEY not configured — reset URL logged for dev");
  }

  res.json({ ok: true });
});

// ── Reset password ─────────────────────────────────────────────────────────
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, newPassword } = req.body ?? {};
  if (!token || typeof token !== "string" || !newPassword || typeof newPassword !== "string") {
    res.status(400).json({ error: "Invalid request." });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const [otp] = await db.select().from(emailOtpsTable)
    .where(and(
      eq(emailOtpsTable.code, token),
      eq(emailOtpsTable.purpose, "reset_password"),
      eq(emailOtpsTable.used, false),
    ))
    .limit(1);

  if (!otp) {
    res.status(400).json({ error: "Invalid or already-used reset link. Please request a new one." });
    return;
  }
  if (new Date() > otp.expiresAt) {
    await db.update(emailOtpsTable).set({ used: true }).where(eq(emailOtpsTable.id, otp.id));
    res.status(400).json({ error: "This reset link has expired. Please request a new one." });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, otp.userId));
  await db.update(emailOtpsTable).set({ used: true }).where(eq(emailOtpsTable.id, otp.id));

  res.json({ ok: true });
});

// ── Get public user ────────────────────────────────────────────────────────
router.get("/users/:id", optionalAuth, async (req: AuthRequest, res, next): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) { next(); return; }  // non-numeric — let other routers handle

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
      verificationType: usersTable.verificationType,
      createdAt: usersTable.createdAt,
      artistId: artistsTable.id,
    })
    .from(usersTable)
    .leftJoin(artistsTable, eq(artistsTable.userId, usersTable.id))
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!row) { res.status(404).json({ error: "User not found" }); return; }

  // Unified follower count: user-type follows + artist-type follows for the linked artist profile.
  const linkedArtistId = row.artistId;
  const [fc] = await db.select({ c: sql<number>`COUNT(DISTINCT ${followsTable.followerId})` })
    .from(followsTable)
    .where(or(
      and(eq(followsTable.targetType, "user"), eq(followsTable.targetId, id)),
      linkedArtistId ? and(eq(followsTable.targetType, "artist"), eq(followsTable.targetId, linkedArtistId)) : undefined,
    ));
  const followerCount = Number(fc?.c ?? 0);

  let isFollowed = false;
  if (req.user) {
    const [f] = await db.select({ id: followsTable.id }).from(followsTable)
      .where(and(
        eq(followsTable.followerId, req.user.userId),
        or(
          and(eq(followsTable.targetType, "user"), eq(followsTable.targetId, id)),
          linkedArtistId ? and(eq(followsTable.targetType, "artist"), eq(followsTable.targetId, linkedArtistId)) : undefined,
        ),
      )).limit(1);
    isFollowed = !!f;
  }

  res.json({ ...row, artistId: row.artistId ?? null, followerCount, isFollowed });
});

// ── Follow / unfollow a user ───────────────────────────────────────────────
router.post("/users/:id/follow", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid user id" }); return; }
  const me = req.user!.userId;

  // Block check — both directions
  const [blocked] = await db.select({ id: userBlocksTable.id }).from(userBlocksTable)
    .where(or(
      and(eq(userBlocksTable.blockerId, me), eq(userBlocksTable.blockedId, id)),
      and(eq(userBlocksTable.blockerId, id), eq(userBlocksTable.blockedId, me)),
    )).limit(1);
  if (blocked) { res.status(403).json({ error: "Cannot follow this user" }); return; }

  await db.insert(followsTable).values({ followerId: me, targetType: "user", targetId: id }).onConflictDoNothing();
  res.json({ ok: true });
});

router.delete("/users/:id/follow", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid user id" }); return; }
  await db.delete(followsTable).where(
    and(eq(followsTable.followerId, req.user!.userId), eq(followsTable.targetType, "user"), eq(followsTable.targetId, id))
  );
  res.json({ ok: true });
});

export default router;
