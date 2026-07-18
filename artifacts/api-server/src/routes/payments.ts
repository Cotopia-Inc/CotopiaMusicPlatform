import { Router } from "express";
import { and, eq, gte, lte, inArray, desc } from "drizzle-orm";
import { db, submissionsTable, appSettingsTable, paymentsTable, usersTable, songsTable, videosTable } from "@workspace/db";
import { InitiatePaymentBody, CapturePaymentBody } from "@workspace/api-zod";
import { requireAuth, requireRole, type AuthRequest } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────

function generateDemoConfirmationNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "DEMO-";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function getPaymentMode(): Promise<string> {
  const [settings] = await db
    .select({ paymentMode: appSettingsTable.paymentMode })
    .from(appSettingsTable)
    .limit(1);
  return settings?.paymentMode ?? "demo";
}

// ── POST /payments/initiate ─────────────────────────────────────────────────
// Creates a payment record for a submission. In demo mode (default), generates
// a real persisted record with isDemo=true and no external payment call.
router.post("/payments/initiate", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = InitiatePaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, parsed.data.submissionId)).limit(1);
  if (!submission) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  if (submission.userId !== req.user!.userId) {
    res.status(403).json({ error: "This payment doesn't belong to your account." });
    return;
  }

  let [settings] = await db.select().from(appSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(appSettingsTable).values({}).returning();
  }

  const paymentMode = settings.paymentMode ?? "demo";
  const plan = submission.plan ?? "basic";
  const PRICES: Record<string, Record<string, number>> = {
    single:  { song: parseFloat(settings.singleSongFee), video: parseFloat(settings.singleVideoFee) },
    basic:   { song: parseFloat(settings.batchSongFee),  video: parseFloat(settings.batchVideoFee) },
    premium: { song: parseFloat(settings.premiumSongFee), video: parseFloat(settings.premiumVideoFee) },
  };
  const fallback = PRICES.basic;
  const amount = PRICES[plan]?.[submission.type] ?? fallback[submission.type];

  const isDemo = paymentMode === "demo";
  const demoConfirmationNumber = isDemo ? generateDemoConfirmationNumber() : null;

  // In demo mode: generate a local order reference — no PayPal API call is made.
  // In sandbox/live mode: a real PayPal order would be created here.
  const orderId = `DEMO-ORDER-${Date.now()}-${submission.id}`;

  const [payment] = await db.insert(paymentsTable).values({
    userId: req.user!.userId,
    submissionId: submission.id,
    provider: isDemo ? "demo" : "paypal",
    paymentMode,
    isDemo,
    paypalOrderId: orderId,
    demoConfirmationNumber,
    amount: String(amount),
    currency: "USD",
    status: "initiated",
  }).returning();

  logger.info(
    { submissionId: submission.id, amount, paymentMode, isDemo, demoConfirmationNumber },
    "Payment initiated",
  );

  res.json({
    orderId,
    paymentMode,
    isDemo,
    demoConfirmationNumber,
    amount,
    currency: "USD",
    // Legacy field — kept for backwards compatibility with older frontend builds
    paypalOrderId: orderId,
    approvalUrl: isDemo ? null : `https://www.paypal.com/checkoutnow?token=${orderId}`,
  });
});

// ── POST /payments/capture ──────────────────────────────────────────────────
// Completes a payment. In demo mode, marks the record as completed immediately
// with no external verification. In sandbox/live mode, would verify with PayPal.
router.post("/payments/capture", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CapturePaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, parsed.data.submissionId)).limit(1);
  if (!submission) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  if (submission.userId !== req.user!.userId) {
    res.status(403).json({ error: "This payment doesn't belong to your account." });
    return;
  }

  // Find the payment record to retrieve the demo confirmation number
  const [paymentRecord] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.submissionId, submission.id))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(1);

  // Mark payment record as completed
  await db.update(paymentsTable)
    .set({ status: "completed" })
    .where(eq(paymentsTable.submissionId, submission.id));

  // Find all sibling submissions in this batch:
  // same user + same content type + still unpaid + created within 10 minutes of the
  // representative submission. All files in a bulk upload are created within seconds of
  // each other, so a 10-minute window safely captures the whole batch without bleeding
  // into unrelated future submissions.
  const batchStart = new Date(new Date(submission.createdAt as string | Date).getTime() - 60_000);
  const batchEnd   = new Date(new Date(submission.createdAt as string | Date).getTime() + 10 * 60_000);

  const batchSiblings = await db
    .select({ id: submissionsTable.id })
    .from(submissionsTable)
    .where(and(
      eq(submissionsTable.userId, submission.userId),
      eq(submissionsTable.type, submission.type),
      eq(submissionsTable.paymentStatus, "unpaid"),
      gte(submissionsTable.createdAt, batchStart),
      lte(submissionsTable.createdAt, batchEnd),
    ));

  const allBatchIds = batchSiblings.map(s => s.id);
  // Always include the representative submission even if it was somehow already marked
  if (!allBatchIds.includes(submission.id)) allBatchIds.push(submission.id);

  // Move the entire batch into the moderation queue in one update
  await db.update(submissionsTable)
    .set({ paymentStatus: "paid", status: "pending_moderator_review" })
    .where(inArray(submissionsTable.id, allBatchIds));

  logger.info(
    {
      submissionId: submission.id,
      batchSize: allBatchIds.length,
      paymentMode: paymentRecord?.paymentMode ?? "demo",
      isDemo: paymentRecord?.isDemo ?? true,
      demoConfirmationNumber: paymentRecord?.demoConfirmationNumber,
    },
    "Payment captured — batch moved to moderator review",
  );

  const [updated] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, submission.id)).limit(1);
  res.json({
    submission: updated,
    isDemo: paymentRecord?.isDemo ?? true,
    paymentMode: paymentRecord?.paymentMode ?? "demo",
    demoConfirmationNumber: paymentRecord?.demoConfirmationNumber ?? null,
  });
});

// ── GET /admin/payment-mode ─────────────────────────────────────────────────
// Returns the current payment mode and whether sandbox/live credentials exist.
// Readable by admin and master_admin.
router.get("/admin/payment-mode", requireAuth, requireRole("admin", "master_admin"), async (_req, res): Promise<void> => {
  const paymentMode = await getPaymentMode();

  const hasPaypalClientId     = Boolean(process.env.PAYPAL_CLIENT_ID);
  const hasPaypalClientSecret = Boolean(process.env.PAYPAL_CLIENT_SECRET);
  const hasPaypalSandboxId     = Boolean(process.env.PAYPAL_SANDBOX_CLIENT_ID);
  const hasPaypalSandboxSecret = Boolean(process.env.PAYPAL_SANDBOX_CLIENT_SECRET);

  const canActivateSandbox = hasPaypalSandboxId && hasPaypalSandboxSecret;
  const canActivateLive    = hasPaypalClientId   && hasPaypalClientSecret;

  res.json({
    paymentMode,
    canActivateSandbox,
    canActivateLive,
    credentialStatus: {
      sandbox: {
        clientId: hasPaypalSandboxId,
        clientSecret: hasPaypalSandboxSecret,
      },
      live: {
        clientId: hasPaypalClientId,
        clientSecret: hasPaypalClientSecret,
      },
    },
  });
});

// ── PATCH /admin/payment-mode ───────────────────────────────────────────────
// Updates the platform payment mode. master_admin only.
// Validates that required PayPal credentials exist before activating sandbox/live.
router.patch("/admin/payment-mode", requireAuth, requireRole("master_admin"), async (req: AuthRequest, res): Promise<void> => {
  const { paymentMode } = req.body as { paymentMode?: string };

  const VALID_MODES = ["demo", "paypal_sandbox", "paypal_live"] as const;
  if (!paymentMode || !VALID_MODES.includes(paymentMode as typeof VALID_MODES[number])) {
    res.status(400).json({ error: `paymentMode must be one of: ${VALID_MODES.join(", ")}` });
    return;
  }

  // Validate credentials exist before switching to a live payment mode
  if (paymentMode === "paypal_sandbox") {
    if (!process.env.PAYPAL_SANDBOX_CLIENT_ID || !process.env.PAYPAL_SANDBOX_CLIENT_SECRET) {
      res.status(422).json({
        error: "Cannot activate PayPal Sandbox: PAYPAL_SANDBOX_CLIENT_ID and PAYPAL_SANDBOX_CLIENT_SECRET must be set in environment variables.",
      });
      return;
    }
  }

  if (paymentMode === "paypal_live") {
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      res.status(422).json({
        error: "Cannot activate PayPal Live: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set in environment variables.",
      });
      return;
    }
  }

  const [settings] = await db.select().from(appSettingsTable).limit(1);
  const previousMode = settings?.paymentMode ?? "demo";

  if (!settings) {
    await db.insert(appSettingsTable).values({ paymentMode }).returning();
  } else {
    await db.update(appSettingsTable).set({ paymentMode }).where(eq(appSettingsTable.id, settings.id));
  }

  logger.info(
    { actor: req.user!.userId, previousMode, newMode: paymentMode },
    "Payment mode changed by master_admin",
  );

  res.json({ paymentMode, previousMode, changedBy: req.user!.userId });
});

// ── GET /admin/payments/reconciliation ─────────────────────────────────────
// Payment reconciliation dashboard — all payments with demo/real separation.
// Admin and master_admin only.
router.get("/admin/payments/reconciliation", requireAuth, requireRole("admin", "master_admin"), async (req, res): Promise<void> => {
  const page  = Math.max(1, Number(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const modeFilter = req.query.mode as string | undefined;
  const statusFilter = req.query.status as string | undefined;

  const conditions = [];
  if (modeFilter && ["demo", "paypal_sandbox", "paypal_live"].includes(modeFilter)) {
    conditions.push(eq(paymentsTable.paymentMode, modeFilter));
  }
  if (statusFilter && ["initiated", "completed", "failed", "refunded", "disputed", "canceled"].includes(statusFilter)) {
    conditions.push(eq(paymentsTable.status, statusFilter));
  }

  const rows = await db
    .select({
      id: paymentsTable.id,
      userId: paymentsTable.userId,
      submissionId: paymentsTable.submissionId,
      provider: paymentsTable.provider,
      paymentMode: paymentsTable.paymentMode,
      isDemo: paymentsTable.isDemo,
      paypalOrderId: paymentsTable.paypalOrderId,
      externalTransactionId: paymentsTable.externalTransactionId,
      demoConfirmationNumber: paymentsTable.demoConfirmationNumber,
      amount: paymentsTable.amount,
      currency: paymentsTable.currency,
      status: paymentsTable.status,
      createdAt: paymentsTable.createdAt,
      updatedAt: paymentsTable.updatedAt,
      userEmail: usersTable.email,
      userName: usersTable.displayName,
    })
    .from(paymentsTable)
    .leftJoin(usersTable, eq(paymentsTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(paymentsTable.createdAt))
    .limit(limit)
    .offset(offset);

  // Summary totals — never mix demo and real money
  const allPayments = await db.select({
    paymentMode: paymentsTable.paymentMode,
    isDemo: paymentsTable.isDemo,
    status: paymentsTable.status,
    amount: paymentsTable.amount,
  }).from(paymentsTable);

  const summary = {
    demo: { total: 0, count: 0 },
    paypal_sandbox: { total: 0, count: 0 },
    paypal_live: { total: 0, count: 0 },
    completed_real_total: 0,
  };

  for (const p of allPayments) {
    if (p.status !== "completed") continue;
    const amt = parseFloat(p.amount) || 0;
    const mode = p.paymentMode ?? "demo";
    if (mode === "demo" || p.isDemo) {
      summary.demo.total += amt;
      summary.demo.count += 1;
    } else if (mode === "paypal_sandbox") {
      summary.paypal_sandbox.total += amt;
      summary.paypal_sandbox.count += 1;
    } else if (mode === "paypal_live") {
      summary.paypal_live.total += amt;
      summary.paypal_live.count += 1;
      summary.completed_real_total += amt;
    }
  }

  res.json({
    payments: rows,
    summary,
    pagination: {
      page,
      limit,
      total: rows.length,
    },
  });
});

export default router;
