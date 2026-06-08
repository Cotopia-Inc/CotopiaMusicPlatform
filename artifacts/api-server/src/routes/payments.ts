import { Router } from "express";
import { eq } from "drizzle-orm";
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
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  let [settings] = await db.select().from(appSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(appSettingsTable).values({}).returning();
  }

  const plan = submission.plan ?? "basic";
  let amount: number;
  if (plan === "premium") {
    amount = submission.type === "song"
      ? parseFloat(settings.songSubmissionFee) * 3
      : parseFloat(settings.videoSubmissionFee) * 3;
  } else {
    amount = submission.type === "song"
      ? parseFloat(settings.songSubmissionFee)
      : parseFloat(settings.videoSubmissionFee);
  }

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
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Mark payment record as completed
  await db.update(paymentsTable)
    .set({ status: "completed" })
    .where(eq(paymentsTable.submissionId, submission.id));

  // Move submission to pending_review with paid status
  const [updated] = await db.update(submissionsTable)
    .set({ paymentStatus: "paid", status: "pending_review" })
    .where(eq(submissionsTable.id, submission.id))
    .returning();

  logger.info({ submissionId: submission.id, paypalOrderId: parsed.data.paypalOrderId }, "Payment captured");

  res.json(updated);
});

export default router;
