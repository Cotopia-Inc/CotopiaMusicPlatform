import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray, and } from "drizzle-orm";
import { db, songsTable, badgesTable, userBadgesTable } from "@workspace/db";
import { api, bearer, createUser, createArtistProfile, cleanupUsers } from "./helpers";

const createdUserIds: number[] = [];
const createdSongIds: number[] = [];

afterAll(async () => {
  if (createdSongIds.length) {
    await db.delete(songsTable).where(inArray(songsTable.id, createdSongIds));
  }
  await cleanupUsers(createdUserIds);
});

async function createSong(artistId: number): Promise<number> {
  const [song] = await db.insert(songsTable).values({
    artistId,
    title: `qa_song_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    status: "published",
  }).returning();
  createdSongIds.push(song.id);
  return song.id;
}

async function hasBadge(userId: number, badgeName: string): Promise<boolean> {
  const [badge] = await db.select({ id: badgesTable.id }).from(badgesTable).where(eq(badgesTable.name, badgeName)).limit(1);
  if (!badge) return false;
  const [row] = await db.select({ id: userBadgesTable.id }).from(userBadgesTable)
    .where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.badgeId, badge.id))).limit(1);
  return !!row;
}

describe("creator support settings", () => {
  it("returns disabled defaults when a creator has no settings row yet", async () => {
    const creator = await createUser({ role: "artist" });
    createdUserIds.push(creator.id);

    const res = await api().get("/api/creator-support/settings").set("Authorization", bearer(creator.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      supportEnabled: false,
      provider: "paypal",
      paypalEmail: null,
      paypalMeLink: null,
      thankYouMessage: null,
      supportWallEnabled: true,
      supportWallRequiresApproval: false,
    });
  });

  it("rejects enabling support without a paypal email or paypal.me link", async () => {
    const creator = await createUser({ role: "artist" });
    createdUserIds.push(creator.id);

    const res = await api()
      .put("/api/creator-support/settings")
      .set("Authorization", bearer(creator.token))
      .send({ supportEnabled: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it("enables support with a paypal email, thank-you message, and wall settings; status is public and never leaks payment details", async () => {
    const creator = await createUser({ role: "artist" });
    createdUserIds.push(creator.id);

    const res = await api()
      .put("/api/creator-support/settings")
      .set("Authorization", bearer(creator.token))
      .send({
        supportEnabled: true,
        paypalEmail: "creator@example.com",
        thankYouMessage: "Thanks so much for the support!",
        supportWallEnabled: true,
        supportWallRequiresApproval: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.supportEnabled).toBe(true);
    expect(res.body.paypalEmail).toBe("creator@example.com");
    expect(res.body.thankYouMessage).toBe("Thanks so much for the support!");
    expect(res.body.supportWallRequiresApproval).toBe(true);

    // Public, no auth required.
    const statusRes = await api().get(`/api/creator-support/status/${creator.id}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.userId).toBe(creator.id);
    expect(statusRes.body.supportEnabled).toBe(true);
    expect(typeof statusRes.body.supporterCount).toBe("number");
    expect(statusRes.body.thankYouMessage).toBe("Thanks so much for the support!");
    expect(statusRes.body.paypalEmail).toBeUndefined();
    expect(statusRes.body.paypalMeLink).toBeUndefined();
  });
});

describe("creator support tips", () => {
  it("blocks tipping a creator who hasn't enabled support", async () => {
    const creator = await createUser({ role: "artist" });
    createdUserIds.push(creator.id);
    const artistId = await createArtistProfile(creator.id);
    const songId = await createSong(artistId);

    const supporter = await createUser({ role: "listener" });
    createdUserIds.push(supporter.id);

    const res = await api()
      .post("/api/creator-support/tips")
      .set("Authorization", bearer(supporter.token))
      .send({ contentType: "song", contentId: songId, amount: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/hasn't enabled/i);
  });

  it("creates a demo tip transaction with a SUP-DEMO reference, notifies the creator, and updates real (never-inflated) supporter counts", async () => {
    const creator = await createUser({ role: "artist" });
    createdUserIds.push(creator.id);
    const artistId = await createArtistProfile(creator.id);
    const songId = await createSong(artistId);

    await api()
      .put("/api/creator-support/settings")
      .set("Authorization", bearer(creator.token))
      .send({ supportEnabled: true, paypalEmail: "creator@example.com" });

    const supporter = await createUser({ role: "listener" });
    createdUserIds.push(supporter.id);

    const res = await api()
      .post("/api/creator-support/tips")
      .set("Authorization", bearer(supporter.token))
      .send({ contentType: "song", contentId: songId, amount: 7.5, message: "Love this track!" });

    expect(res.status).toBe(201);
    expect(res.body.transactionRef).toMatch(/^SUP-DEMO-\d{6}$/);
    expect(res.body.mode).toBe("demo");
    expect(res.body.status).toBe("completed");
    expect(res.body.amount).toBe(7.5);
    expect(res.body.messageVisibility).toBe("private");

    const dashboardRes = await api()
      .get("/api/creator-support/dashboard")
      .set("Authorization", bearer(creator.token));
    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.body.mode).toBe("demo");
    expect(dashboardRes.body.totalDemoTips).toBeGreaterThanOrEqual(1);
    expect(dashboardRes.body.totalDemoAmount).toBeGreaterThanOrEqual(7.5);
    expect(dashboardRes.body.supporterCount).toBeGreaterThanOrEqual(1);
    expect(dashboardRes.body.recentActivity.some((a: { transactionRef: string }) => a.transactionRef === res.body.transactionRef)).toBe(true);

    const statusRes = await api().get(`/api/creator-support/status/${creator.id}`);
    expect(statusRes.body.supporterCount).toBeGreaterThanOrEqual(1);

    expect(await hasBadge(supporter.id, "First Supporter")).toBe(true);
    expect(await hasBadge(creator.id, "Fan Supported Creator")).toBe(true);
  });

  it("blocks a creator from tipping themselves", async () => {
    const creator = await createUser({ role: "artist" });
    createdUserIds.push(creator.id);
    const artistId = await createArtistProfile(creator.id);
    const songId = await createSong(artistId);

    await api()
      .put("/api/creator-support/settings")
      .set("Authorization", bearer(creator.token))
      .send({ supportEnabled: true, paypalEmail: "creator@example.com" });

    const res = await api()
      .post("/api/creator-support/tips")
      .set("Authorization", bearer(creator.token))
      .send({ contentType: "song", contentId: songId, amount: 3 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/support yourself/i);
  });

  it("returns 404 for a nonexistent content id", async () => {
    const supporter = await createUser({ role: "listener" });
    createdUserIds.push(supporter.id);

    const res = await api()
      .post("/api/creator-support/tips")
      .set("Authorization", bearer(supporter.token))
      .send({ contentType: "song", contentId: 999999999, amount: 3 });
    expect(res.status).toBe(404);
  });

  it("rate-limits repeated tip attempts from the same supporter", async () => {
    const creator = await createUser({ role: "artist" });
    createdUserIds.push(creator.id);
    const artistId = await createArtistProfile(creator.id);
    const songId = await createSong(artistId);

    await api()
      .put("/api/creator-support/settings")
      .set("Authorization", bearer(creator.token))
      .send({ supportEnabled: true, paypalEmail: "creator@example.com" });

    const supporter = await createUser({ role: "listener" });
    createdUserIds.push(supporter.id);

    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await api()
        .post("/api/creator-support/tips")
        .set("Authorization", bearer(supporter.token))
        .send({ contentType: "song", contentId: songId, amount: 1 });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("allows tipping a staff account directly via contentType 'creator' once they enable support themselves", async () => {
    const moderator = await createUser({ role: "moderator" });
    createdUserIds.push(moderator.id);

    await api()
      .put("/api/creator-support/settings")
      .set("Authorization", bearer(moderator.token))
      .send({ supportEnabled: true, paypalMeLink: "https://paypal.me/modtest" });

    const supporter = await createUser({ role: "listener" });
    createdUserIds.push(supporter.id);

    const res = await api()
      .post("/api/creator-support/tips")
      .set("Authorization", bearer(supporter.token))
      .send({ contentType: "creator", contentId: moderator.id, amount: 4 });
    expect(res.status).toBe(201);

    const statusRes = await api().get(`/api/creator-support/status/${moderator.id}`);
    expect(statusRes.body.supportEnabled).toBe(true);
    expect(statusRes.body.supporterCount).toBeGreaterThanOrEqual(1);
  });
});

describe("support wall", () => {
  it("only shows approved public/anonymous messages, hides private ones, and masks the supporter name when anonymous", async () => {
    const creator = await createUser({ role: "artist" });
    createdUserIds.push(creator.id);
    const artistId = await createArtistProfile(creator.id);
    const songId = await createSong(artistId);

    await api()
      .put("/api/creator-support/settings")
      .set("Authorization", bearer(creator.token))
      .send({ supportEnabled: true, paypalEmail: "creator@example.com", supportWallRequiresApproval: false });

    const publicSupporter = await createUser({ role: "listener" });
    createdUserIds.push(publicSupporter.id);
    const anonSupporter = await createUser({ role: "listener" });
    createdUserIds.push(anonSupporter.id);
    const privateSupporter = await createUser({ role: "listener" });
    createdUserIds.push(privateSupporter.id);

    await api().post("/api/creator-support/tips").set("Authorization", bearer(publicSupporter.token))
      .send({ contentType: "song", contentId: songId, amount: 2, message: "Great song!", messageVisibility: "public" });
    await api().post("/api/creator-support/tips").set("Authorization", bearer(anonSupporter.token))
      .send({ contentType: "song", contentId: songId, amount: 2, message: "Keep it up!", messageVisibility: "anonymous" });
    await api().post("/api/creator-support/tips").set("Authorization", bearer(privateSupporter.token))
      .send({ contentType: "song", contentId: songId, amount: 2, message: "Secret support", messageVisibility: "private" });

    const wallRes = await api().get(`/api/creator-support/wall/${creator.id}`);
    expect(wallRes.status).toBe(200);
    expect(wallRes.body.items.some((i: { message: string }) => i.message === "Secret support")).toBe(false);

    const publicItem = wallRes.body.items.find((i: { message: string }) => i.message === "Great song!");
    expect(publicItem.isAnonymous).toBe(false);
    expect(publicItem.supporterDisplayName).toBeTruthy();

    const anonItem = wallRes.body.items.find((i: { message: string }) => i.message === "Keep it up!");
    expect(anonItem.isAnonymous).toBe(true);
    expect(anonItem.supporterDisplayName).toBeNull();
  });

  it("holds messages as pending when the creator requires approval, and only approved ones surface on the wall", async () => {
    const creator = await createUser({ role: "artist" });
    createdUserIds.push(creator.id);
    const artistId = await createArtistProfile(creator.id);
    const songId = await createSong(artistId);

    await api()
      .put("/api/creator-support/settings")
      .set("Authorization", bearer(creator.token))
      .send({ supportEnabled: true, paypalEmail: "creator@example.com", supportWallRequiresApproval: true });

    const supporter = await createUser({ role: "listener" });
    createdUserIds.push(supporter.id);

    const tipRes = await api().post("/api/creator-support/tips").set("Authorization", bearer(supporter.token))
      .send({ contentType: "song", contentId: songId, amount: 3, message: "Needs approval", messageVisibility: "public" });
    expect(tipRes.status).toBe(201);

    const wallBefore = await api().get(`/api/creator-support/wall/${creator.id}`);
    expect(wallBefore.body.items.some((i: { message: string }) => i.message === "Needs approval")).toBe(false);

    const dashboardRes = await api().get("/api/creator-support/dashboard").set("Authorization", bearer(creator.token));
    expect(dashboardRes.body.pendingWallApprovalCount).toBeGreaterThanOrEqual(1);

    const admin = await createUser({ role: "master_admin" });
    createdUserIds.push(admin.id);
    const moderateRes = await api()
      .put(`/api/admin/creator-support/wall/${tipRes.body.id}/moderation`)
      .set("Authorization", bearer(admin.token))
      .send({ action: "approve" });
    expect(moderateRes.status).toBe(200);
    expect(moderateRes.body.moderationStatus).toBe("approved");

    const wallAfter = await api().get(`/api/creator-support/wall/${creator.id}`);
    expect(wallAfter.body.items.some((i: { message: string }) => i.message === "Needs approval")).toBe(true);
  });

  it("lets the recipient hide their own public message, but not someone else's", async () => {
    const creator = await createUser({ role: "artist" });
    createdUserIds.push(creator.id);
    const artistId = await createArtistProfile(creator.id);
    const songId = await createSong(artistId);

    await api()
      .put("/api/creator-support/settings")
      .set("Authorization", bearer(creator.token))
      .send({ supportEnabled: true, paypalEmail: "creator@example.com" });

    const supporter = await createUser({ role: "listener" });
    createdUserIds.push(supporter.id);

    const tipRes = await api().post("/api/creator-support/tips").set("Authorization", bearer(supporter.token))
      .send({ contentType: "song", contentId: songId, amount: 2, message: "Hide me", messageVisibility: "public" });

    const otherUser = await createUser({ role: "listener" });
    createdUserIds.push(otherUser.id);
    const forbidden = await api().post(`/api/creator-support/wall/${tipRes.body.id}/hide`).set("Authorization", bearer(otherUser.token));
    expect(forbidden.status).toBe(403);

    const hideRes = await api().post(`/api/creator-support/wall/${tipRes.body.id}/hide`).set("Authorization", bearer(creator.token));
    expect(hideRes.status).toBe(200);
    expect(hideRes.body.moderationStatus).toBe("hidden");

    const wallAfter = await api().get(`/api/creator-support/wall/${creator.id}`);
    expect(wallAfter.body.items.some((i: { message: string }) => i.message === "Hide me")).toBe(false);
  });
});

describe("admin creator support overview", () => {
  it("rejects non-admin access", async () => {
    const listener = await createUser({ role: "listener" });
    createdUserIds.push(listener.id);

    const res = await api().get("/api/admin/creator-support").set("Authorization", bearer(listener.token));
    expect(res.status).toBe(403);
  });

  it("returns platform-wide demo support stats for admins, including pending moderation count", async () => {
    const admin = await createUser({ role: "master_admin" });
    createdUserIds.push(admin.id);

    const res = await api().get("/api/admin/creator-support").set("Authorization", bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.paymentMode).toBe("demo");
    expect(typeof res.body.totalDemoTransactions).toBe("number");
    expect(typeof res.body.pendingModerationCount).toBe("number");
    expect(Array.isArray(res.body.mostSupportedCreators)).toBe(true);
    expect(Array.isArray(res.body.recentTransactions)).toBe(true);
  });

  it("lets an admin override a transaction's status for demo testing, excluding non-completed ones from financial totals", async () => {
    const creator = await createUser({ role: "artist" });
    createdUserIds.push(creator.id);
    const artistId = await createArtistProfile(creator.id);
    const songId = await createSong(artistId);

    await api()
      .put("/api/creator-support/settings")
      .set("Authorization", bearer(creator.token))
      .send({ supportEnabled: true, paypalEmail: "creator@example.com" });

    const supporter = await createUser({ role: "listener" });
    createdUserIds.push(supporter.id);

    const tipRes = await api().post("/api/creator-support/tips").set("Authorization", bearer(supporter.token))
      .send({ contentType: "song", contentId: songId, amount: 9 });

    const admin = await createUser({ role: "master_admin" });
    createdUserIds.push(admin.id);

    const beforeDashboard = await api().get("/api/creator-support/dashboard").set("Authorization", bearer(creator.token));
    const amountBefore = beforeDashboard.body.totalDemoAmount;

    const statusUpdateRes = await api()
      .put(`/api/admin/creator-support/transactions/${tipRes.body.id}/status`)
      .set("Authorization", bearer(admin.token))
      .send({ status: "failed" });
    expect(statusUpdateRes.status).toBe(200);
    expect(statusUpdateRes.body.status).toBe("failed");

    const afterDashboard = await api().get("/api/creator-support/dashboard").set("Authorization", bearer(creator.token));
    expect(afterDashboard.body.totalDemoAmount).toBeCloseTo(amountBefore - 9, 5);
  });
});
