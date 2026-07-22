import { describe, it, expect, afterAll } from "vitest";
import { db, submissionsTable, adminAuditLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { api, bearer, createUser, cleanupUsers } from "./helpers";

const created: number[] = [];

afterAll(async () => {
  await cleanupUsers(created);
});

async function artist() {
  const u = await createUser({ role: "artist", emailVerified: true });
  created.push(u.id);
  return u;
}

describe("fully_ai_generated submission gate — POST /submissions", () => {
  it("returns 422 with FULLY_AI_REJECTED for a song", async () => {
    const u = await artist();
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
    const u = await artist();
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
    const u = await artist();
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
      .select({ status: submissionsTable.status, creationMethod: submissionsTable.creationMethod, aiReviewStatus: submissionsTable.aiReviewStatus })
      .from(submissionsTable)
      .where(and(eq(submissionsTable.userId, u.id), eq(submissionsTable.creationMethod, "fully_ai_generated")))
      .limit(5);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.status).toBe("rejected");
    expect(rows[0]!.aiReviewStatus).toBe("auto_rejected");
  });

  it("writes a fully_ai_auto_rejected audit log entry", async () => {
    const u = await artist();
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
      .select({ action: adminAuditLogsTable.action, adminUserId: adminAuditLogsTable.adminUserId })
      .from(adminAuditLogsTable)
      .where(and(
        eq(adminAuditLogsTable.adminUserId, u.id),
        eq(adminAuditLogsTable.action, "fully_ai_auto_rejected"),
      ))
      .limit(10);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]!.action).toBe("fully_ai_auto_rejected");
  });

  it("allows submission with human_created creationMethod (returns 201)", async () => {
    const u = await artist();
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
    const u = await artist();
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

describe("fully_ai_generated submission gate — POST /submissions/bulk", () => {
  it("returns 422 with FULLY_AI_REJECTED for bulk songs", async () => {
    const u = await artist();
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
    const u = await artist();
    const res = await api()
      .post("/api/submissions/bulk")
      .set("Authorization", bearer(u.token))
      .send({
        type: "song",
        plan: "basic",
        creationMethod: "fully_ai_generated",
        files: [
          { title: "Bulk Audit 1", fileUrl: "https://example.com/ba1.mp3" },
        ],
      });
    expect(res.status).toBe(422);

    const rows = await db
      .select({ status: submissionsTable.status, creationMethod: submissionsTable.creationMethod })
      .from(submissionsTable)
      .where(and(eq(submissionsTable.userId, u.id), eq(submissionsTable.creationMethod, "fully_ai_generated")))
      .limit(5);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.status).toBe("rejected");
  });

  it("allows bulk submission with ai_assisted creationMethod (returns 201)", async () => {
    const u = await artist();
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
