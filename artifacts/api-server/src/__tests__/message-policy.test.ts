import { describe, it, expect, afterAll } from "vitest";
import {
  api,
  bearer,
  createUser,
  createArtistProfile,
  followArtist,
  cleanupUsers,
} from "./helpers";

const created: number[] = [];
afterAll(async () => {
  await cleanupUsers(created);
});

describe("message-policy enforcement", () => {
  it("everyone: any verified sender may message", async () => {
    const sender = await createUser({ emailVerified: true });
    const recipient = await createUser({ emailVerified: true, messagePolicy: "everyone" });
    created.push(sender.id, recipient.id);
    const res = await api()
      .post("/api/messages")
      .set("Authorization", bearer(sender.token))
      .send({ toUserId: recipient.id, body: "hi" });
    expect(res.status).toBe(201);
  });

  it("nobody: messaging is rejected", async () => {
    const sender = await createUser({ emailVerified: true });
    const recipient = await createUser({ emailVerified: true, messagePolicy: "nobody" });
    created.push(sender.id, recipient.id);
    const res = await api()
      .post("/api/messages")
      .set("Authorization", bearer(sender.token))
      .send({ toUserId: recipient.id, body: "hi" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not accepting messages/i);
  });

  it("verified_only: rejects a non-verified-badge sender", async () => {
    const sender = await createUser({ emailVerified: true, isVerified: false });
    const recipient = await createUser({ emailVerified: true, messagePolicy: "verified_only" });
    created.push(sender.id, recipient.id);
    const res = await api()
      .post("/api/messages")
      .set("Authorization", bearer(sender.token))
      .send({ toUserId: recipient.id, body: "hi" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/only verified users/i);
  });

  it("verified_only: allows a verified-badge sender", async () => {
    const sender = await createUser({ emailVerified: true, isVerified: true });
    const recipient = await createUser({ emailVerified: true, messagePolicy: "verified_only" });
    created.push(sender.id, recipient.id);
    const res = await api()
      .post("/api/messages")
      .set("Authorization", bearer(sender.token))
      .send({ toUserId: recipient.id, body: "hi" });
    expect(res.status).toBe(201);
  });

  it("followers_only: rejects a sender who does not follow the recipient", async () => {
    const sender = await createUser({ emailVerified: true });
    const recipient = await createUser({ emailVerified: true, messagePolicy: "followers_only" });
    created.push(sender.id, recipient.id);
    await createArtistProfile(recipient.id);
    const res = await api()
      .post("/api/messages")
      .set("Authorization", bearer(sender.token))
      .send({ toUserId: recipient.id, body: "hi" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/only accepts messages from followers/i);
  });

  it("followers_only: allows a sender who follows the recipient's artist profile", async () => {
    const sender = await createUser({ emailVerified: true });
    const recipient = await createUser({ emailVerified: true, messagePolicy: "followers_only" });
    created.push(sender.id, recipient.id);
    const artistId = await createArtistProfile(recipient.id);
    await followArtist(sender.id, artistId);
    const res = await api()
      .post("/api/messages")
      .set("Authorization", bearer(sender.token))
      .send({ toUserId: recipient.id, body: "hi" });
    expect(res.status).toBe(201);
  });

  it("staff bypass: staff may message even when policy is nobody", async () => {
    const staff = await createUser({ role: "moderator", emailVerified: true });
    const recipient = await createUser({ emailVerified: true, messagePolicy: "nobody" });
    created.push(staff.id, recipient.id);
    const res = await api()
      .post("/api/messages")
      .set("Authorization", bearer(staff.token))
      .send({ toUserId: recipient.id, body: "staff override" });
    expect(res.status).toBe(201);
  });
});
