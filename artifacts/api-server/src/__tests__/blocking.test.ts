import { describe, it, expect, afterAll } from "vitest";
import {
  api,
  bearer,
  createUser,
  createArtistProfile,
  blockUser,
  cleanupUsers,
} from "./helpers";

const created: number[] = [];
afterAll(async () => {
  await cleanupUsers(created);
});

describe("blocking enforcement — follows", () => {
  it("rejects following when the follower has blocked the target", async () => {
    const follower = await createUser();
    const target = await createUser();
    created.push(follower.id, target.id);
    const artistId = await createArtistProfile(target.id);
    await blockUser(follower.id, target.id);

    const res = await api()
      .post(`/api/artists/${artistId}/follow`)
      .set("Authorization", bearer(follower.token))
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cannot follow/i);
  });

  it("rejects following when the target has blocked the follower", async () => {
    const follower = await createUser();
    const target = await createUser();
    created.push(follower.id, target.id);
    const artistId = await createArtistProfile(target.id);
    await blockUser(target.id, follower.id);

    const res = await api()
      .post(`/api/artists/${artistId}/follow`)
      .set("Authorization", bearer(follower.token))
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cannot follow/i);
  });

  it("allows following when there is no block relationship", async () => {
    const follower = await createUser();
    const target = await createUser();
    created.push(follower.id, target.id);
    const artistId = await createArtistProfile(target.id);

    const res = await api()
      .post(`/api/artists/${artistId}/follow`)
      .set("Authorization", bearer(follower.token))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("blocking enforcement — messages", () => {
  it("rejects messaging when the sender has blocked the recipient", async () => {
    const sender = await createUser({ emailVerified: true });
    const recipient = await createUser({ emailVerified: true, messagePolicy: "everyone" });
    created.push(sender.id, recipient.id);
    await blockUser(sender.id, recipient.id);

    const res = await api()
      .post("/api/messages")
      .set("Authorization", bearer(sender.token))
      .send({ toUserId: recipient.id, body: "hi" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cannot message/i);
  });

  it("rejects messaging when the recipient has blocked the sender", async () => {
    const sender = await createUser({ emailVerified: true });
    const recipient = await createUser({ emailVerified: true, messagePolicy: "everyone" });
    created.push(sender.id, recipient.id);
    await blockUser(recipient.id, sender.id);

    const res = await api()
      .post("/api/messages")
      .set("Authorization", bearer(sender.token))
      .send({ toUserId: recipient.id, body: "hi" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cannot message/i);
  });
});
