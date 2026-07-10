import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db, songsTable } from "@workspace/db";
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

describe("creator support settings", () => {
  it("returns disabled defaults when a creator has no settings row yet", async () => {
    const creator = await createUser({ role: "artist" });
    createdUserIds.push(creator.id);

    const res = await api().get("/api/creator-support/settings").set("Authorization", bearer(creator.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ supportEnabled: false, provider: "paypal", paypalEmail: null, paypalMeLink: null });
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

  it("enables support with a paypal email and persists it", async () => {
    const creator = await createUser({ role: "artist" });
    createdUserIds.push(creator.id);

    const res = await api()
      .put("/api/creator-support/settings")
      .set("Authorization", bearer(creator.token))
      .send({ supportEnabled: true, paypalEmail: "creator@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.supportEnabled).toBe(true);
    expect(res.body.paypalEmail).toBe("creator@example.com");

    const statusRes = await api()
      .get(`/api/creator-support/status/${creator.id}`)
      .set("Authorization", bearer(creator.token));
    expect(statusRes.status).toBe(200);
    expect(statusRes.body).toEqual({ userId: creator.id, supportEnabled: true });
    expect(statusRes.body.paypalEmail).toBeUndefined();
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

  it("creates a demo tip transaction with a SUP-DEMO reference and notifies the creator", async () => {
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

    const dashboardRes = await api()
      .get("/api/creator-support/dashboard")
      .set("Authorization", bearer(creator.token));
    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.body.mode).toBe("demo");
    expect(dashboardRes.body.totalDemoTips).toBeGreaterThanOrEqual(1);
    expect(dashboardRes.body.totalDemoAmount).toBeGreaterThanOrEqual(7.5);
    expect(dashboardRes.body.recentActivity.some((a: { transactionRef: string }) => a.transactionRef === res.body.transactionRef)).toBe(true);
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
});

describe("admin creator support overview", () => {
  it("rejects non-admin access", async () => {
    const listener = await createUser({ role: "listener" });
    createdUserIds.push(listener.id);

    const res = await api().get("/api/admin/creator-support").set("Authorization", bearer(listener.token));
    expect(res.status).toBe(403);
  });

  it("returns platform-wide demo support stats for admins", async () => {
    const admin = await createUser({ role: "master_admin" });
    createdUserIds.push(admin.id);

    const res = await api().get("/api/admin/creator-support").set("Authorization", bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.paymentMode).toBe("demo");
    expect(typeof res.body.totalDemoTransactions).toBe("number");
    expect(Array.isArray(res.body.mostSupportedCreators)).toBe(true);
    expect(Array.isArray(res.body.recentTransactions)).toBe(true);
  });
});
