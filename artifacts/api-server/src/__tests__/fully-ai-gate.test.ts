import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  db, submissionsTable, adminAuditLogsTable,
  appSettingsTable, trustAppealsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { api, bearer, createUser, cleanupUsers, type TestUser } from "./helpers";

const created: number[] = [];

afterAll(async () => {
  await cleanupUsers(created);
});

async function makeArtist(): Promise<TestUser> {
  const u = await createUser({ role: "artist", emailVerified: true });
  created.push(u.id);
  return u;
}

async function makeStaff(role: "admin" | "master_admin" | "moderator"): Promise<TestUser> {
  const u = await createUser({ role, emailVerified: true });
  created.push(u.id);
  return u;
}

// ─── Gate tests WITH autoRejectFullyAi enabled ──────────────────────────────

describe("fully_ai_generated gate (autoRejectFullyAi=true) — POST /submissions", () => {
  beforeAll(async () => {
    await db.update(appSettingsTable).set({ autoRejectFullyAi: true });
  });
  afterAll(async () => {
    await db.update(appSettingsTable).set({ autoRejectFullyAi: false });
  });

  it("returns 422 with FULLY_AI_REJECTED for a song", async () => {
    const u = await makeArtist();
    const res = await api()
      .post("/api/submissions")
      .set("Authorization", bearer(u.token))
      .send({
        type: "song",
        title: "AI Song",
        plan: "basic",
        creationMethod: "fully_ai_generated",
        fileUrl: "https://example.com/test.mp3",
      });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("FULLY_AI_REJECTED");
    expect(res.body.appealLink).toBe("/trust/appeals");
  });

  it("returns 422 with FULLY_AI_REJECTED for a video", async () => {
    const u = await makeArtist();
    const res = await api()
      .post("/api/submissions")
      .set("Authorization", bearer(u.token))
      .send({
        type: "video",
        title: "AI Video",
        plan: "basic",
        creationMethod: "fully_ai_generated",
        fileUrl: "https://example.com/test.mp4",
      });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("FULLY_AI_REJECTED");
  });

  it("saves the submission record as rejected for audit purposes", async () => {
    const u = await makeArtist();
    const res = await api()
      .post("/api/submissions")
      .set("Authorization", bearer(u.token))
      .send({
        type: "song",
        title: "Audit Trail Song",
        plan: "basic",
        creationMethod: "fully_ai_generated",
        fileUrl: "https://example.com/audit.mp3",
      });
    expect(res.status).toBe(422);
    const rows = await db
      .select({
        status: submissionsTable.status,
        creationMethod: submissionsTable.creationMethod,
        aiReviewStatus: submissionsTable.aiReviewStatus,
      })
      .from(submissionsTable)
      .where(and(
        eq(submissionsTable.userId, u.id),
        eq(submissionsTable.creationMethod, "fully_ai_generated"),
      ))
      .limit(5);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.status).toBe("rejected");
    expect(rows[0]!.aiReviewStatus).toBe("auto_rejected");
  });

  it("writes a fully_ai_auto_rejected audit log entry with before/after fields", async () => {
    const u = await makeArtist();
    const res = await api()
      .post("/api/submissions")
      .set("Authorization", bearer(u.token))
      .send({
        type: "song",
        title: "Audit Log Song",
        plan: "basic",
        creationMethod: "fully_ai_generated",
        fileUrl: "https://example.com/log.mp3",
      });
    expect(res.status).toBe(422);
    const logs = await db
      .select({ action: adminAuditLogsTable.action, metadata: adminAuditLogsTable.metadata })
      .from(adminAuditLogsTable)
      .where(and(
        eq(adminAuditLogsTable.adminUserId, u.id),
        eq(adminAuditLogsTable.action, "fully_ai_auto_rejected"),
      ))
      .limit(10);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]!.action).toBe("fully_ai_auto_rejected");
    const meta = logs[0]!.metadata as Record<string, unknown>;
    expect("before" in meta).toBe(true);
    expect("after" in meta).toBe(true);
    expect(meta.after).toBe("auto_rejected");
  });

  it("allows submission with human_created creationMethod (returns 201)", async () => {
    const u = await makeArtist();
    const res = await api()
      .post("/api/submissions")
      .set("Authorization", bearer(u.token))
      .send({
        type: "song",
        title: "Human Song",
        plan: "basic",
        creationMethod: "human_created",
        fileUrl: "https://example.com/human.mp3",
      });
    expect(res.status).toBe(201);
    expect(res.body.creationMethod).toBe("human_created");
  });

  it("defaults to unclassified for unknown/missing creationMethod (returns 201)", async () => {
    const u = await makeArtist();
    const res = await api()
      .post("/api/submissions")
      .set("Authorization", bearer(u.token))
      .send({
        type: "song",
        title: "No Tag Song",
        plan: "basic",
        fileUrl: "https://example.com/notag.mp3",
      });
    expect(res.status).toBe(201);
  });
});

// ─── Gate test WITH autoRejectFullyAi disabled ──────────────────────────────

describe("fully_ai_generated gate (autoRejectFullyAi=false) — POST /submissions", () => {
  // autoRejectFullyAi defaults to false and is restored after the previous suite.

  it("accepts fully_ai_generated and flags for moderator review when gate is disabled", async () => {
    const u = await makeArtist();
    const res = await api()
      .post("/api/submissions")
      .set("Authorization", bearer(u.token))
      .send({
        type: "song",
        title: "AI Song (gate off)",
        plan: "basic",
        creationMethod: "fully_ai_generated",
        fileUrl: "https://example.com/gateoff.mp3",
      });
    expect(res.status).toBe(201);
    const rows = await db
      .select({ status: submissionsTable.status, aiReviewStatus: submissionsTable.aiReviewStatus })
      .from(submissionsTable)
      .where(and(
        eq(submissionsTable.userId, u.id),
        eq(submissionsTable.creationMethod, "fully_ai_generated"),
      ))
      .limit(5);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.status).toBe("draft");
    expect(rows[0]!.aiReviewStatus).toBe("moderator_review");
  });
});

// ─── Bulk gate tests WITH autoRejectFullyAi enabled ─────────────────────────

describe("fully_ai_generated gate (autoRejectFullyAi=true) — POST /submissions/bulk", () => {
  beforeAll(async () => {
    await db.update(appSettingsTable).set({ autoRejectFullyAi: true });
  });
  afterAll(async () => {
    await db.update(appSettingsTable).set({ autoRejectFullyAi: false });
  });

  it("returns 422 with FULLY_AI_REJECTED for bulk songs", async () => {
    const u = await makeArtist();
    const res = await api()
      .post("/api/submissions/bulk")
      .set("Authorization", bearer(u.token))
      .send({
        type: "song",
        plan: "basic",
        creationMethod: "fully_ai_generated",
        files: [
          { title: "AI Bulk 1", fileUrl: "https://example.com/b1.mp3" },
          { title: "AI Bulk 2", fileUrl: "https://example.com/b2.mp3" },
        ],
      });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("FULLY_AI_REJECTED");
    expect(res.body.appealLink).toBe("/trust/appeals");
  });

  it("saves bulk submissions as rejected for audit", async () => {
    const u = await makeArtist();
    const res = await api()
      .post("/api/submissions/bulk")
      .set("Authorization", bearer(u.token))
      .send({
        type: "song",
        plan: "basic",
        creationMethod: "fully_ai_generated",
        files: [{ title: "Bulk Audit 1", fileUrl: "https://example.com/ba1.mp3" }],
      });
    expect(res.status).toBe(422);
    const rows = await db
      .select({ status: submissionsTable.status, creationMethod: submissionsTable.creationMethod })
      .from(submissionsTable)
      .where(and(
        eq(submissionsTable.userId, u.id),
        eq(submissionsTable.creationMethod, "fully_ai_generated"),
      ))
      .limit(5);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.status).toBe("rejected");
  });

  it("allows bulk submission with ai_assisted creationMethod (returns 201)", async () => {
    const u = await makeArtist();
    const res = await api()
      .post("/api/submissions/bulk")
      .set("Authorization", bearer(u.token))
      .send({
        type: "song",
        plan: "basic",
        creationMethod: "ai_assisted",
        files: [{ title: "AI Assisted Song", fileUrl: "https://example.com/aia.mp3" }],
      });
    expect(res.status).toBe(201);
  });
});

// ─── Audit: appeal_created ────────────────────────────────────────────────

describe("audit — appeal_created (authenticated submitter)", () => {
  it("writes an appeal_created audit log entry for authenticated users", async () => {
    const u = await makeArtist();
    const res = await api()
      .post("/api/trust/appeals")
      .set("Authorization", bearer(u.token))
      .send({
        actionType: "ai_classification",
        reason: "I believe the AI tag applied to my song is incorrect — the track is human-composed and should not be marked as AI-generated.",
        relatedContent: "song:123",
      });
    expect(res.status).toBe(201);
    const logs = await db
      .select({ action: adminAuditLogsTable.action, adminUserId: adminAuditLogsTable.adminUserId })
      .from(adminAuditLogsTable)
      .where(and(
        eq(adminAuditLogsTable.adminUserId, u.id),
        eq(adminAuditLogsTable.action, "appeal_created"),
      ))
      .limit(5);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]!.action).toBe("appeal_created");
    expect(logs[0]!.adminUserId).toBe(u.id);

    // Verify before/after transition fields
    const logs2 = await db
      .select({ metadata: adminAuditLogsTable.metadata })
      .from(adminAuditLogsTable)
      .where(and(
        eq(adminAuditLogsTable.adminUserId, u.id),
        eq(adminAuditLogsTable.action, "appeal_created"),
      ))
      .limit(5);
    const meta = logs2[0]!.metadata as Record<string, unknown>;
    expect(meta.before).toBeNull();
    expect(meta.after).toBe("submitted");
  });
});

// ─── Audit: appeal_decision + classification_reversed ─────────────────────

describe("audit — appeal_decision and classification_reversed", () => {
  it("writes appeal_decision audit entry with before/after when admin updates appeal status", async () => {
    const admin = await makeStaff("admin");
    const [appeal] = await db.insert(trustAppealsTable).values({
      actionType: "ai_classification",
      reason: "Testing appeal decision audit — human-made track was mislabeled as fully AI-generated.",
      status: "received",
    }).returning();

    const res = await api()
      .patch(`/api/admin/trust/appeals/${appeal.id}`)
      .set("Authorization", bearer(admin.token))
      .send({ status: "upheld", adminNotes: "After review, the original tag is correct." });
    expect(res.status).toBe(200);

    const logs = await db
      .select({ action: adminAuditLogsTable.action, metadata: adminAuditLogsTable.metadata })
      .from(adminAuditLogsTable)
      .where(and(
        eq(adminAuditLogsTable.adminUserId, admin.id),
        eq(adminAuditLogsTable.action, "appeal_decision"),
        eq(adminAuditLogsTable.targetId, appeal.id),
      ))
      .limit(5);
    expect(logs.length).toBeGreaterThan(0);
    const meta = logs[0]!.metadata as Record<string, unknown>;
    expect(meta.before).toBe("received");
    expect(meta.after).toBe("upheld");
  });

  it("writes classification_reversed audit entry when appeal is reversed", async () => {
    const admin = await makeStaff("admin");
    const [appeal] = await db.insert(trustAppealsTable).values({
      actionType: "ai_classification",
      reason: "Track is human-composed and was incorrectly flagged as fully AI-generated — requesting reversal.",
      relatedContent: "song:456",
      status: "under_review",
    }).returning();

    const res = await api()
      .patch(`/api/admin/trust/appeals/${appeal.id}`)
      .set("Authorization", bearer(admin.token))
      .send({ status: "reversed", adminNotes: "Verified original creator statement — classification reversed." });
    expect(res.status).toBe(200);

    const reversalLogs = await db
      .select({ action: adminAuditLogsTable.action, targetId: adminAuditLogsTable.targetId })
      .from(adminAuditLogsTable)
      .where(and(
        eq(adminAuditLogsTable.adminUserId, admin.id),
        eq(adminAuditLogsTable.action, "classification_reversed"),
        eq(adminAuditLogsTable.targetId, appeal.id),
      ))
      .limit(5);
    expect(reversalLogs.length).toBeGreaterThan(0);
    expect(reversalLogs[0]!.targetId).toBe(appeal.id);

    // Verify before/after classification fields
    const reversalLogs2 = await db
      .select({ metadata: adminAuditLogsTable.metadata })
      .from(adminAuditLogsTable)
      .where(and(
        eq(adminAuditLogsTable.adminUserId, admin.id),
        eq(adminAuditLogsTable.action, "classification_reversed"),
        eq(adminAuditLogsTable.targetId, appeal.id),
      ))
      .limit(5);
    const meta = reversalLogs2[0]!.metadata as Record<string, unknown>;
    expect("before" in meta).toBe(true);
    expect("after" in meta).toBe(true);
    expect(meta.before).toBe("ai_classification");
    expect(meta.after).toBe("reversed");
  });
});

// ─── Audit: settings_ai_policy_changed ────────────────────────────────────

describe("audit — settings_ai_policy_changed (PATCH /admin/settings)", () => {
  let masterAdmin: TestUser;

  beforeAll(async () => {
    masterAdmin = await makeStaff("master_admin");
    await db.update(appSettingsTable).set({ enableAiReview: true });
  });
  afterAll(async () => {
    await db.update(appSettingsTable).set({ enableAiReview: true });
  });

  it("writes one audit entry per changed AI policy field with before/after values", async () => {
    const res = await api()
      .patch("/api/admin/settings")
      .set("Authorization", bearer(masterAdmin.token))
      .send({ enableAiReview: false });
    expect(res.status).toBe(200);

    const logs = await db
      .select({ action: adminAuditLogsTable.action, metadata: adminAuditLogsTable.metadata })
      .from(adminAuditLogsTable)
      .where(and(
        eq(adminAuditLogsTable.adminUserId, masterAdmin.id),
        eq(adminAuditLogsTable.action, "settings_ai_policy_changed"),
      ))
      .limit(10);
    expect(logs.length).toBeGreaterThan(0);

    const enableAiReviewLog = logs.find((l) => {
      const m = l.metadata as Record<string, unknown>;
      return m.field === "enableAiReview";
    });
    expect(enableAiReviewLog).toBeDefined();
    const meta = enableAiReviewLog!.metadata as Record<string, unknown>;
    expect(meta.before).toBe(true);
    expect(meta.after).toBe(false);
  });
});

// ─── Audit: recommend action (ai_review_recommend) ───────────────────────

describe("audit — recommend action (ai_review_recommend)", () => {
  it("writes ai_review_recommend audit log for moderator recommendation", async () => {
    const artist = await makeArtist();
    const mod = await makeStaff("moderator");

    const subRes = await api()
      .post("/api/submissions")
      .set("Authorization", bearer(artist.token))
      .send({
        type: "song",
        title: "Recommend Test Song",
        plan: "basic",
        creationMethod: "human_created",
        fileUrl: "https://example.com/recommend.mp3",
      });
    expect(subRes.status).toBe(201);
    const contentId = subRes.body.contentId as number;
    expect(contentId).toBeGreaterThan(0);

    const reviewRes = await api()
      .patch(`/api/admin/ai-review/song/${contentId}`)
      .set("Authorization", bearer(mod.token))
      .send({
        action: "recommend",
        moderatorNotes: "After listening, this track is clearly human-made. I recommend approval.",
      });
    expect(reviewRes.status).toBe(200);

    const logs = await db
      .select({ action: adminAuditLogsTable.action, metadata: adminAuditLogsTable.metadata })
      .from(adminAuditLogsTable)
      .where(and(
        eq(adminAuditLogsTable.adminUserId, mod.id),
        eq(adminAuditLogsTable.action, "ai_review_recommend"),
      ))
      .limit(5);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]!.action).toBe("ai_review_recommend");
    const meta = logs[0]!.metadata as Record<string, unknown>;
    expect("before" in meta).toBe(true);
    expect("after" in meta).toBe(true);
    expect(meta.after).toBe("escalated_to_admin");
  });

  it("returns 400 when recommend action is missing moderatorNotes", async () => {
    const artist = await makeArtist();
    const mod = await makeStaff("moderator");

    const subRes = await api()
      .post("/api/submissions")
      .set("Authorization", bearer(artist.token))
      .send({
        type: "song",
        title: "Recommend No Notes Song",
        plan: "basic",
        creationMethod: "human_created",
        fileUrl: "https://example.com/recommend-nonotes.mp3",
      });
    expect(subRes.status).toBe(201);
    const contentId = subRes.body.contentId as number;

    const reviewRes = await api()
      .patch(`/api/admin/ai-review/song/${contentId}`)
      .set("Authorization", bearer(mod.token))
      .send({ action: "recommend" });
    expect(reviewRes.status).toBe(400);
    expect(reviewRes.body.error).toMatch(/recommendation note/i);
  });
});

// ─── Audit: flag, escalate, request_evidence actions ─────────────────────

async function makeContentForReview(artistToken: string, title: string): Promise<number> {
  const res = await api()
    .post("/api/submissions")
    .set("Authorization", bearer(artistToken))
    .send({ type: "song", title, plan: "basic", creationMethod: "human_created", fileUrl: "https://example.com/test.mp3" });
  expect(res.status).toBe(201);
  return res.body.contentId as number;
}

describe("audit — flag, escalate, request_evidence actions", () => {
  it("writes ai_review_flag audit log when moderator flags content", async () => {
    const artist = await makeArtist();
    const mod = await makeStaff("moderator");
    const contentId = await makeContentForReview(artist.token, "Flag Test Song");

    const res = await api()
      .patch(`/api/admin/ai-review/song/${contentId}`)
      .set("Authorization", bearer(mod.token))
      .send({ action: "flag" });
    expect(res.status).toBe(200);

    const logs = await db
      .select({ action: adminAuditLogsTable.action, metadata: adminAuditLogsTable.metadata })
      .from(adminAuditLogsTable)
      .where(and(
        eq(adminAuditLogsTable.adminUserId, mod.id),
        eq(adminAuditLogsTable.action, "ai_review_flag"),
      ))
      .limit(5);
    expect(logs.length).toBeGreaterThan(0);
    const meta = logs[0]!.metadata as Record<string, unknown>;
    expect("before" in meta).toBe(true);
    expect("after" in meta).toBe(true);
    expect(meta.after).toBe("moderator_review");
  });

  it("writes ai_review_escalate audit log when content is escalated", async () => {
    const artist = await makeArtist();
    const mod = await makeStaff("moderator");
    const contentId = await makeContentForReview(artist.token, "Escalate Test Song");

    const res = await api()
      .patch(`/api/admin/ai-review/song/${contentId}`)
      .set("Authorization", bearer(mod.token))
      .send({ action: "escalate" });
    expect(res.status).toBe(200);

    const logs = await db
      .select({ action: adminAuditLogsTable.action, metadata: adminAuditLogsTable.metadata })
      .from(adminAuditLogsTable)
      .where(and(
        eq(adminAuditLogsTable.adminUserId, mod.id),
        eq(adminAuditLogsTable.action, "ai_review_escalate"),
      ))
      .limit(5);
    expect(logs.length).toBeGreaterThan(0);
    const meta = logs[0]!.metadata as Record<string, unknown>;
    expect("before" in meta).toBe(true);
    expect("after" in meta).toBe(true);
    expect(meta.after).toBe("escalated_to_admin");
  });

  it("writes ai_review_request_evidence audit log when admin requests evidence", async () => {
    const artist = await makeArtist();
    const admin = await makeStaff("admin");
    const contentId = await makeContentForReview(artist.token, "Evidence Test Song");

    const res = await api()
      .patch(`/api/admin/ai-review/song/${contentId}`)
      .set("Authorization", bearer(admin.token))
      .send({ action: "request_evidence" });
    expect(res.status).toBe(200);

    const logs = await db
      .select({ action: adminAuditLogsTable.action, metadata: adminAuditLogsTable.metadata })
      .from(adminAuditLogsTable)
      .where(and(
        eq(adminAuditLogsTable.adminUserId, admin.id),
        eq(adminAuditLogsTable.action, "ai_review_request_evidence"),
      ))
      .limit(5);
    expect(logs.length).toBeGreaterThan(0);
    const meta = logs[0]!.metadata as Record<string, unknown>;
    expect("before" in meta).toBe(true);
    expect("after" in meta).toBe(true);
    expect(meta.after).toBe("evidence_requested");
  });
});
