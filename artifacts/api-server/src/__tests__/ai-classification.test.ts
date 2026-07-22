/**
 * AI Classification test suite — 15 spec cases.
 *
 * Covers creator self-tagging, fully-AI gate enforcement, tag lock enforcement,
 * moderator review workflows, admin review controls, and detection-unavailable
 * graceful degradation.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  db, songsTable, adminAuditLogsTable,
  appSettingsTable, submissionsTable, aiDetectionScansTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  api, bearer, createUser, createArtistProfile, cleanupUsers, type TestUser,
} from "./helpers";


const created: number[] = [];

afterAll(async () => {
  await cleanupUsers(created);
});

async function makeArtist(): Promise<TestUser> {
  const u = await createUser({ role: "artist", emailVerified: true });
  created.push(u.id);
  return u;
}

async function makeModerator(): Promise<TestUser> {
  const u = await createUser({ role: "moderator", emailVerified: true });
  created.push(u.id);
  return u;
}

async function makeAdmin(): Promise<TestUser> {
  const u = await createUser({ role: "admin", emailVerified: true });
  created.push(u.id);
  return u;
}

async function insertSong(
  artistId: number,
  overrides: Partial<typeof songsTable.$inferInsert> = {},
): Promise<number> {
  const [row] = await db.insert(songsTable).values({
    artistId,
    title: `Test AI Song ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    duration: 0,
    creationMethod: "unclassified",
    effectiveDisplayTag: "unclassified",
    streamUrl: "https://example.com/test.mp3",
    ...overrides,
  }).returning();
  return row.id;
}

async function latestAuditLog(userId: number, action: string) {
  const [row] = await db
    .select()
    .from(adminAuditLogsTable)
    .where(and(
      eq(adminAuditLogsTable.adminUserId, userId),
      eq(adminAuditLogsTable.action, action),
    ))
    .orderBy(desc(adminAuditLogsTable.createdAt))
    .limit(1);
  return row ?? null;
}

// ── Cases 1–3: Creator tag selection ─────────────────────────────────────────

describe("AI classification — creator self-tag (cases 1–3)", () => {
  let artist: TestUser;
  let artistProfileId: number;

  beforeAll(async () => {
    await db.update(appSettingsTable).set({ allowCreatorSelfTagging: true });
    artist = await makeArtist();
    artistProfileId = await createArtistProfile(artist.id);
  });

  afterAll(async () => {
    await db.update(appSettingsTable).set({ allowCreatorSelfTagging: true });
  });

  it("case 1: human_created tag is saved with creator tagSource and audit log entry", async () => {
    const songId = await insertSong(artistProfileId, { creationMethod: "unclassified" });

    const res = await api()
      .post(`/api/songs/${songId}/creation-tag`)
      .set("Authorization", bearer(artist.token))
      .send({ creationMethod: "human_created" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.creationMethod).toBe("human_created");

    const [song] = await db
      .select({ creationMethod: songsTable.creationMethod, tagSource: songsTable.tagSource, creatorSelectedTag: songsTable.creatorSelectedTag })
      .from(songsTable).where(eq(songsTable.id, songId)).limit(1);
    expect(song!.creationMethod).toBe("human_created");
    expect(song!.tagSource).toBe("creator");
    expect(song!.creatorSelectedTag).toBe("human_created");

    const log = await latestAuditLog(artist.id, "creator_tag_set");
    expect(log).not.toBeNull();
    expect((log!.metadata as Record<string, unknown>).after).toBe("human_created");
  });

  it("case 2: ai_assisted tag is saved with creator tagSource and audit log entry", async () => {
    const songId = await insertSong(artistProfileId, { creationMethod: "unclassified" });

    const res = await api()
      .post(`/api/songs/${songId}/creation-tag`)
      .set("Authorization", bearer(artist.token))
      .send({ creationMethod: "ai_assisted" });

    expect(res.status).toBe(200);
    expect(res.body.creationMethod).toBe("ai_assisted");

    const [song] = await db
      .select({ creationMethod: songsTable.creationMethod, creatorSelectedTag: songsTable.creatorSelectedTag })
      .from(songsTable).where(eq(songsTable.id, songId)).limit(1);
    expect(song!.creationMethod).toBe("ai_assisted");
    expect(song!.creatorSelectedTag).toBe("ai_assisted");

    const log = await latestAuditLog(artist.id, "creator_tag_set");
    expect(log).not.toBeNull();
  });

  it("case 3: hybrid_human_ai tag is saved with creator tagSource and audit log entry", async () => {
    const songId = await insertSong(artistProfileId, { creationMethod: "unclassified" });

    const res = await api()
      .post(`/api/songs/${songId}/creation-tag`)
      .set("Authorization", bearer(artist.token))
      .send({ creationMethod: "hybrid_human_ai" });

    expect(res.status).toBe(200);
    expect(res.body.creationMethod).toBe("hybrid_human_ai");

    const [song] = await db
      .select({ creationMethod: songsTable.creationMethod, tagSource: songsTable.tagSource })
      .from(songsTable).where(eq(songsTable.id, songId)).limit(1);
    expect(song!.creationMethod).toBe("hybrid_human_ai");
    expect(song!.tagSource).toBe("creator");

    const log = await latestAuditLog(artist.id, "creator_tag_set");
    expect(log).not.toBeNull();
    expect((log!.metadata as Record<string, unknown>).after).toBe("hybrid_human_ai");
  });
});

// ── Cases 4–5: Fully-AI gate — server enforcement ────────────────────────────

describe("AI classification — fully-AI gate server enforcement (cases 4–5)", () => {
  let artist: TestUser;

  beforeAll(async () => {
    await db.update(appSettingsTable).set({ autoRejectFullyAi: true });
    artist = await makeArtist();
  });

  afterAll(async () => {
    await db.update(appSettingsTable).set({ autoRejectFullyAi: false });
  });

  it("case 4: fully_ai_generated declaration blocks submission with 422, record saved as rejected", async () => {
    const res = await api()
      .post("/api/submissions")
      .set("Authorization", bearer(artist.token))
      .send({
        type: "song",
        title: "AI Song Case 4",
        plan: "basic",
        creationMethod: "fully_ai_generated",
        fileUrl: "https://example.com/ai-case4.mp3",
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("FULLY_AI_REJECTED");
    expect(res.body.appealLink).toBe("/trust/appeals");

    const rows = await db
      .select({
        status: submissionsTable.status,
        aiReviewStatus: submissionsTable.aiReviewStatus,
        paymentStatus: submissionsTable.paymentStatus,
      })
      .from(submissionsTable)
      .where(and(
        eq(submissionsTable.userId, artist.id),
        eq(submissionsTable.creationMethod, "fully_ai_generated"),
      ))
      .orderBy(desc(submissionsTable.createdAt))
      .limit(1);
    expect(rows.length).toBe(1);
    expect(rows[0]!.status).toBe("rejected");
    expect(rows[0]!.aiReviewStatus).toBe("auto_rejected");
    // No fee charged — paymentStatus must remain unpaid (no PayPal order created)
    expect(rows[0]!.paymentStatus).toBe("unpaid");
  });

  it("case 5: server enforces the fully-AI block even via the bulk endpoint (client cannot skip)", async () => {
    const res = await api()
      .post("/api/submissions/bulk")
      .set("Authorization", bearer(artist.token))
      .send({
        type: "song",
        plan: "basic",
        creationMethod: "fully_ai_generated",
        files: [
          { title: "Bulk AI Song A", fileUrl: "https://example.com/bulk-ai-a.mp3" },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("FULLY_AI_REJECTED");

    const rows = await db
      .select({
        status: submissionsTable.status,
        aiReviewStatus: submissionsTable.aiReviewStatus,
        paymentStatus: submissionsTable.paymentStatus,
      })
      .from(submissionsTable)
      .where(and(
        eq(submissionsTable.userId, artist.id),
        eq(submissionsTable.creationMethod, "fully_ai_generated"),
      ))
      .orderBy(desc(submissionsTable.createdAt))
      .limit(1);
    expect(rows[0]!.status).toBe("rejected");
    expect(rows[0]!.aiReviewStatus).toBe("auto_rejected");
    // No fee charged — paymentStatus must remain unpaid (no PayPal order created)
    expect(rows[0]!.paymentStatus).toBe("unpaid");
  });
});

// ── Cases 6–7: Tag lock enforcement ──────────────────────────────────────────

describe("AI classification — tag lock enforcement (cases 6–7)", () => {
  let artist: TestUser;
  let artistProfileId: number;

  beforeAll(async () => {
    await db.update(appSettingsTable).set({ allowCreatorSelfTagging: true });
    artist = await makeArtist();
    artistProfileId = await createArtistProfile(artist.id);
  });

  it("case 6: creator can remove their own unlocked tag (reset to unclassified) — returns 200", async () => {
    const songId = await insertSong(artistProfileId, {
      creationMethod: "ai_assisted",
      creatorSelectedTag: "ai_assisted",
      tagSource: "creator",
      tagLocked: false,
    });

    // "Remove" the tag by resetting to unclassified — the only way to clear via the creator endpoint
    const res = await api()
      .post(`/api/songs/${songId}/creation-tag`)
      .set("Authorization", bearer(artist.token))
      .send({ creationMethod: "unclassified" });

    expect(res.status).toBe(200);
    expect(res.body.creationMethod).toBe("unclassified");

    const [song] = await db
      .select({ creationMethod: songsTable.creationMethod, creatorSelectedTag: songsTable.creatorSelectedTag })
      .from(songsTable).where(eq(songsTable.id, songId)).limit(1);
    expect(song!.creationMethod).toBe("unclassified");
    // creatorSelectedTag is updated to "unclassified" (the tag was removed/reset)
    expect(song!.creatorSelectedTag).toBe("unclassified");
  });

  it("case 7: creator cannot overwrite an admin-locked tag — returns 403 with locked-tag message", async () => {
    const songId = await insertSong(artistProfileId, {
      creationMethod: "fully_ai_generated",
      platformAssignedTag: "fully_ai_generated",
      tagSource: "admin",
      tagLocked: true,
    });

    const res = await api()
      .post(`/api/songs/${songId}/creation-tag`)
      .set("Authorization", bearer(artist.token))
      .send({ creationMethod: "human_created" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/locked/i);
  });
});

// ── Cases 8–9: Moderator workflow ────────────────────────────────────────────

describe("AI classification — moderator workflow (cases 8–9)", () => {
  let moderator: TestUser;
  let artistProfileId: number;

  beforeAll(async () => {
    const artistUser = await makeArtist();
    moderator = await makeModerator();
    artistProfileId = await createArtistProfile(artistUser.id);
  });

  it("case 8: moderator can flag (→ moderator_review) then escalate (→ escalated_to_admin) with audit logs", async () => {
    const songId = await insertSong(artistProfileId);

    const flagRes = await api()
      .patch(`/api/admin/ai-review/song/${songId}`)
      .set("Authorization", bearer(moderator.token))
      .send({ action: "flag" });

    expect(flagRes.status).toBe(200);

    const [afterFlag] = await db
      .select({ aiReviewStatus: songsTable.aiReviewStatus })
      .from(songsTable).where(eq(songsTable.id, songId)).limit(1);
    expect(afterFlag!.aiReviewStatus).toBe("moderator_review");

    const escalateRes = await api()
      .patch(`/api/admin/ai-review/song/${songId}`)
      .set("Authorization", bearer(moderator.token))
      .send({ action: "escalate" });

    expect(escalateRes.status).toBe(200);

    const [afterEscalate] = await db
      .select({ aiReviewStatus: songsTable.aiReviewStatus })
      .from(songsTable).where(eq(songsTable.id, songId)).limit(1);
    expect(afterEscalate!.aiReviewStatus).toBe("escalated_to_admin");

    const flagLog = await latestAuditLog(moderator.id, "ai_review_flag");
    const escalateLog = await latestAuditLog(moderator.id, "ai_review_escalate");
    expect(flagLog).not.toBeNull();
    expect(escalateLog).not.toBeNull();
  });

  it("case 9: moderator cannot lock a tag — returns 403", async () => {
    const songId = await insertSong(artistProfileId);

    const res = await api()
      .patch(`/api/admin/ai-review/song/${songId}`)
      .set("Authorization", bearer(moderator.token))
      .send({ action: "lock", aiOverrideReason: "Moderator trying to lock" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });
});

// ── Cases 10–14: Admin review controls ───────────────────────────────────────

describe("AI classification — admin review controls (cases 10–14)", () => {
  let admin: TestUser;
  let artistProfileId: number;

  beforeAll(async () => {
    const artistUser = await makeArtist();
    admin = await makeAdmin();
    artistProfileId = await createArtistProfile(artistUser.id);
  });

  it("case 10: admin assign_tag sets platformAssignedTag, locks tag, writes audit log", async () => {
    const songId = await insertSong(artistProfileId);

    const res = await api()
      .patch(`/api/admin/ai-review/song/${songId}`)
      .set("Authorization", bearer(admin.token))
      .send({
        action: "assign_tag",
        platformAssignedTag: "fully_ai_generated",
        aiOverrideReason: "Detection scan confirmed AI generation with 97% confidence.",
      });

    expect(res.status).toBe(200);
    expect(res.body.platformAssignedTag).toBe("fully_ai_generated");
    expect(res.body.tagLocked).toBe(true);

    const [song] = await db
      .select({ platformAssignedTag: songsTable.platformAssignedTag, tagLocked: songsTable.tagLocked, tagSource: songsTable.tagSource })
      .from(songsTable).where(eq(songsTable.id, songId)).limit(1);
    expect(song!.platformAssignedTag).toBe("fully_ai_generated");
    expect(song!.tagLocked).toBe(true);
    expect(song!.tagSource).toBe("admin");

    const log = await latestAuditLog(admin.id, "ai_review_assign_tag");
    expect(log).not.toBeNull();
    expect((log!.metadata as Record<string, unknown>).platformAssignedTag).toBe("fully_ai_generated");
  });

  it("case 11: admin untag clears platformAssignedTag and writes audit log", async () => {
    const songId = await insertSong(artistProfileId, {
      platformAssignedTag: "fully_ai_generated",
      tagSource: "admin",
      tagLocked: true,
      effectiveDisplayTag: "fully_ai_generated",
    });

    const res = await api()
      .patch(`/api/admin/ai-review/song/${songId}`)
      .set("Authorization", bearer(admin.token))
      .send({ action: "untag" });

    expect(res.status).toBe(200);

    const [song] = await db
      .select({ platformAssignedTag: songsTable.platformAssignedTag })
      .from(songsTable).where(eq(songsTable.id, songId)).limit(1);
    expect(song!.platformAssignedTag).toBeNull();

    const log = await latestAuditLog(admin.id, "ai_review_untag");
    expect(log).not.toBeNull();
  });

  it("case 12: admin lock sets tagLocked=true and writes audit log", async () => {
    const songId = await insertSong(artistProfileId, {
      creationMethod: "ai_assisted",
      creatorSelectedTag: "ai_assisted",
      tagSource: "creator",
      tagLocked: false,
    });

    const res = await api()
      .patch(`/api/admin/ai-review/song/${songId}`)
      .set("Authorization", bearer(admin.token))
      .send({ action: "lock", aiOverrideReason: "Lock pending investigation." });

    expect(res.status).toBe(200);
    expect(res.body.tagLocked).toBe(true);

    const [song] = await db
      .select({ tagLocked: songsTable.tagLocked })
      .from(songsTable).where(eq(songsTable.id, songId)).limit(1);
    expect(song!.tagLocked).toBe(true);

    const log = await latestAuditLog(admin.id, "ai_review_lock");
    expect(log).not.toBeNull();
  });

  it("case 13: admin unlock sets tagLocked=false and writes audit log", async () => {
    const songId = await insertSong(artistProfileId, {
      creationMethod: "fully_ai_generated",
      tagLocked: true,
      tagSource: "admin",
    });

    const res = await api()
      .patch(`/api/admin/ai-review/song/${songId}`)
      .set("Authorization", bearer(admin.token))
      .send({ action: "unlock" });

    expect(res.status).toBe(200);
    expect(res.body.tagLocked).toBe(false);

    const [song] = await db
      .select({ tagLocked: songsTable.tagLocked })
      .from(songsTable).where(eq(songsTable.id, songId)).limit(1);
    expect(song!.tagLocked).toBe(false);

    const log = await latestAuditLog(admin.id, "ai_review_unlock");
    expect(log).not.toBeNull();
  });

  it("case 14a: assign_tag without aiOverrideReason is rejected (422)", async () => {
    const songId = await insertSong(artistProfileId);

    const res = await api()
      .patch(`/api/admin/ai-review/song/${songId}`)
      .set("Authorization", bearer(admin.token))
      .send({ action: "assign_tag", platformAssignedTag: "fully_ai_generated" });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/reason/i);
  });

  it("case 14b: lock without aiOverrideReason is rejected (422)", async () => {
    const songId = await insertSong(artistProfileId);

    const res = await api()
      .patch(`/api/admin/ai-review/song/${songId}`)
      .set("Authorization", bearer(admin.token))
      .send({ action: "lock" });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/reason/i);
  });

  it("case 14c: reject without aiOverrideReason is rejected (422)", async () => {
    const songId = await insertSong(artistProfileId);

    const res = await api()
      .patch(`/api/admin/ai-review/song/${songId}`)
      .set("Authorization", bearer(admin.token))
      .send({ action: "reject" });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/reason/i);
  });
});

// ── Case 15: Detection unavailable graceful degradation ──────────────────────

describe("AI classification — detection unavailable state (case 15)", () => {
  let adminUser: TestUser;
  let songId: number;

  beforeAll(async () => {
    const artistUser = await makeArtist();
    adminUser = await makeAdmin();
    const artistProfileId = await createArtistProfile(artistUser.id);
    songId = await insertSong(artistProfileId);
  });

  it("case 15: HIVE_API_KEY unset → scan endpoint response has no numeric percentage; persisted scan row has null aiLikelihoodPercent", async () => {
    const saved = process.env.HIVE_API_KEY;
    delete process.env.HIVE_API_KEY;
    try {
      // Trigger the scan via the actual API endpoint
      const scanRes = await api()
        .post("/api/admin/ai-review/scan")
        .set("Authorization", bearer(adminUser.token))
        .send({ contentType: "song", contentId: songId });

      // Endpoint always returns 202 (fire-and-forget); response body must not contain any numeric score
      expect(scanRes.status).toBe(202);
      const body = scanRes.body as Record<string, unknown>;
      expect(body.ok).toBe(true);
      expect(body.queued).toBe(true);
      const responseStr = JSON.stringify(body);
      expect(responseStr).not.toMatch(/"aiLikelihoodPercent"\s*:\s*\d/);
      expect(responseStr).not.toMatch(/"percent"\s*:\s*\d/);

      // Wait for the fire-and-forget background task to finish.
      // scanWithHive returns UNAVAILABLE synchronously (no API key → no HTTP call),
      // so this is very fast; 500 ms is ample.
      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      // Verify the stored scan row has null aiLikelihoodPercent — no fabricated score persisted
      const [scan] = await db
        .select({
          aiLikelihoodPercent: aiDetectionScansTable.aiLikelihoodPercent,
          scanStatus: aiDetectionScansTable.scanStatus,
        })
        .from(aiDetectionScansTable)
        .where(and(
          eq(aiDetectionScansTable.contentId, songId),
          eq(aiDetectionScansTable.contentType, "song"),
        ))
        .orderBy(desc(aiDetectionScansTable.createdAt))
        .limit(1);

      expect(scan).toBeDefined();
      expect(scan!.aiLikelihoodPercent).toBeNull();
      expect(typeof scan!.aiLikelihoodPercent).not.toBe("number");
      expect(scan!.scanStatus).toBe("unavailable");
    } finally {
      if (saved !== undefined) process.env.HIVE_API_KEY = saved;
      // Clean up scan rows for this test song
      await db.delete(aiDetectionScansTable).where(and(
        eq(aiDetectionScansTable.contentId, songId),
        eq(aiDetectionScansTable.contentType, "song"),
      ));
    }
  });
});
