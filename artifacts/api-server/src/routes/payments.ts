import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, submissionsTable, appSettingsTable, paymentsTable } from "@workspace/db";
import { InitiatePaymentBody } from "@workspace/api-zod";
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

  let [settings] = await db.select().from(appSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(appSettingsTable).values({}).returning();
  }

  const amount = submission.type === "song"
    ? parseFloat(settings.songSubmissionFee)
    : parseFloat(settings.videoSubmissionFee);

  // In production: create real PayPal order here
  // For MVP: generate a mock order ID
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

export default router;
