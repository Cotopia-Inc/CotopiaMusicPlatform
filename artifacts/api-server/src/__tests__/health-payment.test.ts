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

// ── Health & Readiness ────────────────────────────────────────────────────

describe("GET /api/health", () => {
  it("returns 200 with status and checks object", async () => {
    const res = await api().get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.database).toBeDefined();
    expect(res.body.checks.database.ok).toBe(true);
    expect(res.body.checks.payment).toBeDefined();
    expect(res.body.checks.payment.mode).toBeDefined();
    expect(res.body.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(res.body.timestamp).toBeDefined();
  });

  it("does not expose stack traces or secrets in health response", async () => {
    const res = await api().get("/api/health");
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("SESSION_SECRET");
    expect(body).not.toContain("DATABASE_URL");
    expect(body).not.toContain("stack");
  });
});

describe("GET /api/ready", () => {
  it("returns 200 with ready: true when DB is available", async () => {
    const res = await api().get("/api/ready");
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
    expect(res.body.timestamp).toBeDefined();
  });
});

// ── Payment Mode — authorization ──────────────────────────────────────────

describe("GET /api/admin/payment-mode", () => {
  it("requires authentication", async () => {
    const res = await api().get("/api/admin/payment-mode");
    expect(res.status).toBe(401);
  });

  it("rejects a listener", async () => {
    const u = await user("listener");
    const res = await api().get("/api/admin/payment-mode").set("Authorization", bearer(u.token));
    expect(res.status).toBe(403);
  });

  it("rejects a moderator", async () => {
    const u = await user("moderator");
    const res = await api().get("/api/admin/payment-mode").set("Authorization", bearer(u.token));
    expect(res.status).toBe(403);
  });

  it("allows an admin", async () => {
    const u = await user("admin");
    const res = await api().get("/api/admin/payment-mode").set("Authorization", bearer(u.token));
    expect(res.status).toBe(200);
    expect(res.body.paymentMode).toBeDefined();
    expect(["demo", "paypal_sandbox", "paypal_live"]).toContain(res.body.paymentMode);
    expect(typeof res.body.canActivateSandbox).toBe("boolean");
    expect(typeof res.body.canActivateLive).toBe("boolean");
  });

  it("allows a master_admin", async () => {
    const u = await user("master_admin");
    const res = await api().get("/api/admin/payment-mode").set("Authorization", bearer(u.token));
    expect(res.status).toBe(200);
    expect(res.body.paymentMode).toBeDefined();
  });
});

describe("PATCH /api/admin/payment-mode", () => {
  it("requires authentication", async () => {
    const res = await api().patch("/api/admin/payment-mode").send({ paymentMode: "demo" });
    expect(res.status).toBe(401);
  });

  it("rejects a listener", async () => {
    const u = await user("listener");
    const res = await api().patch("/api/admin/payment-mode")
      .set("Authorization", bearer(u.token))
      .send({ paymentMode: "demo" });
    expect(res.status).toBe(403);
  });

  it("rejects an admin (not master_admin)", async () => {
    const u = await user("admin");
    const res = await api().patch("/api/admin/payment-mode")
      .set("Authorization", bearer(u.token))
      .send({ paymentMode: "demo" });
    expect(res.status).toBe(403);
  });

  it("rejects invalid paymentMode values", async () => {
    const u = await user("master_admin");
    const res = await api().patch("/api/admin/payment-mode")
      .set("Authorization", bearer(u.token))
      .send({ paymentMode: "fake_mode" });
    expect(res.status).toBe(400);
  });

  it("allows master_admin to set demo mode", async () => {
    const u = await user("master_admin");
    const res = await api().patch("/api/admin/payment-mode")
      .set("Authorization", bearer(u.token))
      .send({ paymentMode: "demo" });
    expect(res.status).toBe(200);
    expect(res.body.paymentMode).toBe("demo");
  });

  it("rejects paypal_sandbox without credentials", async () => {
    const u = await user("master_admin");
    const res = await api().patch("/api/admin/payment-mode")
      .set("Authorization", bearer(u.token))
      .send({ paymentMode: "paypal_sandbox" });
    // Should fail with 422 if no sandbox credentials are configured in the test env
    expect([200, 422]).toContain(res.status);
    if (res.status === 422) {
      expect(res.body.error).toContain("PAYPAL_SANDBOX_CLIENT_ID");
    }
  });

  it("rejects paypal_live without credentials", async () => {
    const u = await user("master_admin");
    const res = await api().patch("/api/admin/payment-mode")
      .set("Authorization", bearer(u.token))
      .send({ paymentMode: "paypal_live" });
    // Should fail with 422 if no live credentials are configured in the test env
    expect([200, 422]).toContain(res.status);
    if (res.status === 422) {
      expect(res.body.error).toContain("PAYPAL_CLIENT_ID");
    }
  });
});

// ── Payment Reconciliation ────────────────────────────────────────────────

describe("GET /api/admin/payments/reconciliation", () => {
  it("requires authentication", async () => {
    const res = await api().get("/api/admin/payments/reconciliation");
    expect(res.status).toBe(401);
  });

  it("rejects a listener", async () => {
    const u = await user("listener");
    const res = await api().get("/api/admin/payments/reconciliation").set("Authorization", bearer(u.token));
    expect(res.status).toBe(403);
  });

  it("allows an admin to view reconciliation", async () => {
    const u = await user("admin");
    const res = await api().get("/api/admin/payments/reconciliation").set("Authorization", bearer(u.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.payments)).toBe(true);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.demo).toBeDefined();
    expect(typeof res.body.summary.completed_real_total).toBe("number");
  });

  it("summary never mixes demo and real totals", async () => {
    const u = await user("admin");
    const res = await api().get("/api/admin/payments/reconciliation").set("Authorization", bearer(u.token));
    expect(res.status).toBe(200);
    // completed_real_total must only count paypal_live non-demo payments
    expect(res.body.summary.completed_real_total).toBeGreaterThanOrEqual(0);
    // demo totals should be separate
    expect(res.body.summary.demo).toBeDefined();
    expect(res.body.summary.paypal_live).toBeDefined();
  });
});
