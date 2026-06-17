import { describe, it, expect, afterAll } from "vitest";
import {
  api,
  bearer,
  createUser,
  createArtistProfile,
  cleanupUsers,
  type TestUser,
} from "./helpers";

const created: number[] = [];
afterAll(async () => {
  await cleanupUsers(created);
});

async function unverified(): Promise<TestUser> {
  const u = await createUser({ emailVerified: false });
  created.push(u.id);
  return u;
}

async function verified(): Promise<TestUser> {
  const u = await createUser({ emailVerified: true });
  created.push(u.id);
  return u;
}

describe("email verification gate", () => {
  it("blocks an unverified user from POST /submissions", async () => {
    const u = await unverified();
    const res = await api()
      .post("/api/submissions")
      .set("Authorization", bearer(u.token))
      .send({ type: "song", title: "Test Track", plan: "basic" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("email_not_verified");
  });

  it("blocks an unverified user from POST /submissions/bulk", async () => {
    const u = await unverified();
    const res = await api()
      .post("/api/submissions/bulk")
      .set("Authorization", bearer(u.token))
      .send({ type: "song", plan: "basic", files: [{ title: "T1", fileUrl: "https://x/1.mp3" }] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("email_not_verified");
  });

  it("blocks an unverified user from posting in fan chat", async () => {
    const u = await unverified();
    const res = await api()
      .post("/api/chat/song/1")
      .set("Authorization", bearer(u.token))
      .send({ message: "hello" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("email_not_verified");
  });

  it("blocks an unverified user from sending a private message", async () => {
    const sender = await unverified();
    const recipient = await verified();
    const res = await api()
      .post("/api/messages")
      .set("Authorization", bearer(sender.token))
      .send({ toUserId: recipient.id, body: "hi" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("email_not_verified");
  });

  it("requires authentication before the verification check", async () => {
    const res = await api().post("/api/submissions").send({ type: "song", title: "x" });
    expect(res.status).toBe(401);
  });

  it("allows a verified user past the gate (submission succeeds)", async () => {
    const u = await verified();
    const res = await api()
      .post("/api/submissions")
      .set("Authorization", bearer(u.token))
      .send({ type: "song", title: "Verified Track", plan: "basic" });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Verified Track");
  });

  it("allows a verified user to post in fan chat", async () => {
    const u = await verified();
    const res = await api()
      .post("/api/chat/song/123456")
      .set("Authorization", bearer(u.token))
      .send({ message: "verified hello" });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("verified hello");
  });

  it("allows a verified user to send a private message (everyone policy)", async () => {
    const sender = await verified();
    const recipient = await createUser({ emailVerified: true, messagePolicy: "everyone" });
    created.push(recipient.id);
    // ensure an artist target exists for completeness; everyone policy needs none
    await createArtistProfile(recipient.id);
    const res = await api()
      .post("/api/messages")
      .set("Authorization", bearer(sender.token))
      .send({ toUserId: recipient.id, body: "hi there" });
    expect(res.status).toBe(201);
  });
});
