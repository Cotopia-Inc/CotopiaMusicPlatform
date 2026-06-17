import { describe, it, expect, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { api } from "./helpers";

const createdEmails: string[] = [];
afterAll(async () => {
  if (!createdEmails.length) return;
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.email, createdEmails));
  if (rows.length) {
    await db.delete(usersTable).where(
      inArray(usersTable.id, rows.map((r) => r.id)),
    );
  }
});

function fresh() {
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const email = `reg_${suffix}@test.cotopia`;
  createdEmails.push(email);
  return { email, username: `reg_${suffix}`, password: "password123" };
}

describe("registration age confirmation", () => {
  it("rejects registration when ageConfirmed is missing", async () => {
    const u = fresh();
    const res = await api()
      .post("/api/auth/register")
      .send({ email: u.email, username: u.username, password: u.password, role: "listener" });
    expect(res.status).toBe(400);
  });

  it("rejects registration when ageConfirmed is false", async () => {
    const u = fresh();
    const res = await api()
      .post("/api/auth/register")
      .send({ email: u.email, username: u.username, password: u.password, role: "listener", ageConfirmed: false });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/age requirement/i);
  });

  it("accepts registration when ageConfirmed is true", async () => {
    const u = fresh();
    const res = await api()
      .post("/api/auth/register")
      .send({ email: u.email, username: u.username, password: u.password, role: "listener", ageConfirmed: true });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(u.email);
    expect(res.body.token).toBeTruthy();

    // Confirms the age_confirmation flow actually created the account.
    const [row] = await db.select().from(usersTable).where(eq(usersTable.id, res.body.user.id)).limit(1);
    expect(row).toBeTruthy();
  });
});
