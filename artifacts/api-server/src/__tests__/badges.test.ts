import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db, badgesTable } from "@workspace/db";
import { api, bearer, createUser, cleanupUsers } from "./helpers";

const createdBadgeIds: number[] = [];
const createdUserIds: number[] = [];

function badgeName(suffix: string): string {
  return `qa_badge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}_${suffix}`;
}

afterAll(async () => {
  if (createdBadgeIds.length) {
    await db.delete(badgesTable).where(inArray(badgesTable.id, createdBadgeIds));
  }
  await cleanupUsers(createdUserIds);
});

describe("admin badge color handling", () => {
  it("accepts a hex color on create", async () => {
    const admin = await createUser({ role: "master_admin" });
    createdUserIds.push(admin.id);

    const res = await api()
      .post("/api/admin/badges")
      .set("Authorization", bearer(admin.token))
      .send({ name: badgeName("hex"), description: "hex color", color: "#fff705" });

    expect(res.status).toBe(201);
    expect(res.body.color).toBe("#fff705");
    createdBadgeIds.push(res.body.id);
  });

  it("accepts a CSS named color on create", async () => {
    const admin = await createUser({ role: "master_admin" });
    createdUserIds.push(admin.id);

    const res = await api()
      .post("/api/admin/badges")
      .set("Authorization", bearer(admin.token))
      .send({ name: badgeName("named"), description: "named color", color: "gold" });

    expect(res.status).toBe(201);
    expect(res.body.color).toBe("gold");
    createdBadgeIds.push(res.body.id);
  });

  it("stores null when no color is provided on create", async () => {
    const admin = await createUser({ role: "master_admin" });
    createdUserIds.push(admin.id);

    const res = await api()
      .post("/api/admin/badges")
      .set("Authorization", bearer(admin.token))
      .send({ name: badgeName("nocolor"), description: "no color" });

    expect(res.status).toBe(201);
    expect(res.body.color).toBeNull();
    createdBadgeIds.push(res.body.id);
  });

  it("clears the color to null when an existing badge's color is blanked via PATCH", async () => {
    const admin = await createUser({ role: "master_admin" });
    createdUserIds.push(admin.id);

    const createRes = await api()
      .post("/api/admin/badges")
      .set("Authorization", bearer(admin.token))
      .send({ name: badgeName("clear"), description: "to be cleared", color: "#123456" });
    expect(createRes.status).toBe(201);
    expect(createRes.body.color).toBe("#123456");
    createdBadgeIds.push(createRes.body.id);

    const patchRes = await api()
      .patch(`/api/admin/badges/${createRes.body.id}`)
      .set("Authorization", bearer(admin.token))
      .send({ color: "" });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.color).toBeNull();
  });

  it("returns a 409 (not 500) when creating a badge with a duplicate name", async () => {
    const admin = await createUser({ role: "master_admin" });
    createdUserIds.push(admin.id);

    const name = badgeName("dup");
    const first = await api()
      .post("/api/admin/badges")
      .set("Authorization", bearer(admin.token))
      .send({ name, description: "first" });
    expect(first.status).toBe(201);
    createdBadgeIds.push(first.body.id);

    const second = await api()
      .post("/api/admin/badges")
      .set("Authorization", bearer(admin.token))
      .send({ name, description: "second" });
    expect(second.status).toBe(409);
    expect(second.body.error).toBeTruthy();
  });
});
