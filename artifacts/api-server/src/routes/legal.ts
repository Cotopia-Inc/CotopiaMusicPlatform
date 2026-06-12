import { Router } from "express";
import { desc } from "drizzle-orm";
import { db, dmcaClaimsTable, agreementAcceptancesTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

// ── Public: Submit DMCA Claim ─────────────────────────────────────────────────
router.post("/legal/dmca-claim", async (req, res): Promise<void> => {
  const {
    claimantName, claimantEmail, claimantCompany, copyrightOwner,
    workDescription, infringingUrl, goodFaithStatement,
    accuracyStatement, signature,
  } = req.body as Record<string, unknown>;

  if (!claimantName || !claimantEmail || !copyrightOwner || !workDescription || !infringingUrl || !signature) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  if (!goodFaithStatement || !accuracyStatement) {
    res.status(400).json({ error: "You must affirm both statements to submit a DMCA claim" });
    return;
  }

  const [claim] = await db.insert(dmcaClaimsTable).values({
    claimantName: String(claimantName),
    claimantEmail: String(claimantEmail),
    claimantCompany: claimantCompany ? String(claimantCompany) : null,
    copyrightOwner: String(copyrightOwner),
    workDescription: String(workDescription),
    infringingUrl: String(infringingUrl),
    goodFaithStatement: Boolean(goodFaithStatement),
    accuracyStatement: Boolean(accuracyStatement),
    signature: String(signature),
    status: "received",
  }).returning();

  res.status(201).json({ id: claim.id, status: claim.status, createdAt: claim.createdAt });
});

// ── Authenticated: Record Agreement Acceptance ────────────────────────────────
router.post("/legal/agree", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { agreementType, agreementVersion, submissionId, paymentId, metadata } = req.body as Record<string, unknown>;

  if (!agreementType) {
    res.status(400).json({ error: "agreementType is required" });
    return;
  }

  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null;
  const userAgent = req.headers["user-agent"] || null;

  const [acceptance] = await db.insert(agreementAcceptancesTable).values({
    userId: req.user!.userId,
    agreementType: String(agreementType),
    agreementVersion: agreementVersion ? String(agreementVersion) : "1.0",
    ipAddress,
    userAgent,
    submissionId: submissionId ? Number(submissionId) : null,
    paymentId: paymentId ? Number(paymentId) : null,
    metadata: metadata ?? null,
  }).returning();

  res.status(201).json({ id: acceptance.id, acceptedAt: acceptance.acceptedAt });
});

export default router;
