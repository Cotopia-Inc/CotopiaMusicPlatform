import { describe, it, expect, afterAll } from "vitest";
import { api, bearer, createUser, cleanupUsers } from "./helpers";

const created: number[] = [];
afterAll(async () => {
  await cleanupUsers(created);
});

async function user(role: string) {
  const u = await createUser({ role, emailVerified: true });
  created.push(u.id);
  return u;
}

describe("moderation queue access (MOD_ROLES: moderator, admin, master_admin)", () => {
  it("rejects a listener", async () => {
    const u = await user("listener");
    const res = await api().get("/api/admin/reports").set("Authorization", bearer(u.token));
    expect(res.status).toBe(403);
  });

  it("rejects an editor (editor is not a moderator)", async () => {
    const u = await user("editor");
    const res = await api().get("/api/admin/reports").set("Authorization", bearer(u.token));
    expect(res.status).toBe(403);
  });

  it("allows a moderator", async () => {
    const u = await user("moderator");
    const res = await api().get("/api/admin/reports").set("Authorization", bearer(u.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await api().get("/api/admin/reports");
    expect(res.status).toBe(401);
  });
});

describe("feedback dashboard access (ADMIN_ROLES: admin, master_admin)", () => {
  it("rejects a moderator", async () => {
    const u = await user("moderator");
    const res = await api().get("/api/admin/feedback").set("Authorization", bearer(u.token));
    expect(res.status).toBe(403);
  });

  it("rejects an editor", async () => {
    const u = await user("editor");
    const res = await api().get("/api/admin/feedback").set("Authorization", bearer(u.token));
    expect(res.status).toBe(403);
  });

  it("allows an admin", async () => {
    const u = await user("admin");
    const res = await api().get("/api/admin/feedback").set("Authorization", bearer(u.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("tiered enforcement role gating", () => {
  it("rejects a listener entirely (not a moderator)", async () => {
    const actor = await user("listener");
    const target = await user("listener");
    const res = await api()
      .post("/api/admin/enforcement")
      .set("Authorization", bearer(actor.token))
      .send({ userId: target.id, actionType: "warning", reason: "spam" });
    expect(res.status).toBe(403);
  });

  it("rejects an editor entirely (not a moderator)", async () => {
    const actor = await user("editor");
    const target = await user("listener");
    const res = await api()
      .post("/api/admin/enforcement")
      .set("Authorization", bearer(actor.token))
      .send({ userId: target.id, actionType: "warning", reason: "spam" });
    expect(res.status).toBe(403);
  });

  it("lets a moderator issue a warning", async () => {
    const actor = await user("moderator");
    const target = await user("listener");
    const res = await api()
      .post("/api/admin/enforcement")
      .set("Authorization", bearer(actor.token))
      .send({ userId: target.id, actionType: "warning", reason: "minor violation" });
    expect(res.status).toBe(201);
    expect(res.body.actionType).toBe("warning");
  });

  it("forbids a moderator from issuing a strike", async () => {
    const actor = await user("moderator");
    const target = await user("listener");
    const res = await api()
      .post("/api/admin/enforcement")
      .set("Authorization", bearer(actor.token))
      .send({ userId: target.id, actionType: "strike", reason: "repeat" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/permission to issue a strike/i);
  });

  it("forbids a moderator from issuing a ban", async () => {
    const actor = await user("moderator");
    const target = await user("listener");
    const res = await api()
      .post("/api/admin/enforcement")
      .set("Authorization", bearer(actor.token))
      .send({ userId: target.id, actionType: "ban", reason: "severe" });
    expect(res.status).toBe(403);
  });

  it("lets an admin issue a strike", async () => {
    const actor = await user("admin");
    const target = await user("listener");
    const res = await api()
      .post("/api/admin/enforcement")
      .set("Authorization", bearer(actor.token))
      .send({ userId: target.id, actionType: "strike", reason: "repeat offense" });
    expect(res.status).toBe(201);
    expect(res.body.actionType).toBe("strike");
  });

  it("forbids an admin from issuing a ban (master_admin only)", async () => {
    const actor = await user("admin");
    const target = await user("listener");
    const res = await api()
      .post("/api/admin/enforcement")
      .set("Authorization", bearer(actor.token))
      .send({ userId: target.id, actionType: "ban", reason: "severe" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/permission to issue a ban/i);
  });

  it("lets a master_admin issue a ban", async () => {
    const actor = await user("master_admin");
    const target = await user("listener");
    const res = await api()
      .post("/api/admin/enforcement")
      .set("Authorization", bearer(actor.token))
      .send({ userId: target.id, actionType: "ban", reason: "severe abuse" });
    expect(res.status).toBe(201);
    expect(res.body.actionType).toBe("ban");
  });

  it("forbids a moderator from lifting an enforcement action (admin+ only)", async () => {
    const admin = await user("admin");
    const moderator = await user("moderator");
    const target = await user("listener");
    const issue = await api()
      .post("/api/admin/enforcement")
      .set("Authorization", bearer(admin.token))
      .send({ userId: target.id, actionType: "strike", reason: "to be lifted" });
    expect(issue.status).toBe(201);
    const res = await api()
      .patch(`/api/admin/enforcement/${issue.body.id}/lift`)
      .set("Authorization", bearer(moderator.token))
      .send({});
    expect(res.status).toBe(403);
  });
});
