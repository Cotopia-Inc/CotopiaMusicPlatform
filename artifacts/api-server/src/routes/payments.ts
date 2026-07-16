import { Router } from "express";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { db, submissionsTable, appSettingsTable, paymentsTable } from "@workspace/db";
import { InitiatePaymentBody, CapturePaymentBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

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

  const plan = submission.plan ?? "basic";
  const PRICES: Record<string, Record<string, number>> = {
    single:  { song: parseFloat(settings.singleSongFee), video: parseFloat(settings.singleVideoFee) },
    basic:   { song: parseFloat(settings.batchSongFee),  video: parseFloat(settings.batchVideoFee) },
    premium: { song: parseFloat(settings.premiumSongFee), video: parseFloat(settings.premiumVideoFee) },
  };
  const fallback = PRICES.basic;
  const amount = PRICES[plan]?.[submission.type] ?? fallback[submission.type];

  const mockOrderId = `PAYPAL-${Date.now()}-${submission.id}`;
  const approvalUrl = `https://www.paypal.com/checkoutnow?token=${mockOrderId}`;

  await db.insert(paymentsTable).values({
    userId: req.user!.userId,
    submissionId: submission.id,
    paypalOrderId: mockOrderId,
    amount: String(amount),
    currency: "USD",
    status: "pending",
  });

  logger.info({ submissionId: submission.id, amount, mockOrderId }, "Payment initiated");

  res.json({ paypalOrderId: mockOrderId, approvalUrl, amount });
});

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
    { submissionId: submission.id, batchSize: allBatchIds.length, paypalOrderId: parsed.data.paypalOrderId },
    "Payment captured — batch moved to moderator review",
  );

  const [updated] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, submission.id)).limit(1);
  res.json(updated);
});

export default router;
