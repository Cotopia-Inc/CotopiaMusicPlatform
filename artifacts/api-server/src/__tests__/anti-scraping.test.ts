import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// ── Bot detection ─────────────────────────────────────────────────────────────

describe("Bot detection middleware", () => {
  const PROBE = "/api/platform-config"; // public endpoint, no auth required

  it("allows requests with a real browser User-Agent", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", BROWSER_UA);
    expect(res.status).not.toBe(403);
  });

  it("blocks requests with no User-Agent header", async () => {
    const res = await request(app)
      .get(PROBE)
      .unset("User-Agent");
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "Forbidden" });
  });

  it("blocks python-requests", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", "python-requests/2.31.0");
    expect(res.status).toBe(403);
  });

  it("blocks scrapy", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", "Scrapy/2.11.0 (+https://scrapy.org)");
    expect(res.status).toBe(403);
  });

  it("blocks wget", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", "Wget/1.21.3");
    expect(res.status).toBe(403);
  });

  it("blocks curl", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", "curl/7.88.1");
    expect(res.status).toBe(403);
  });

  it("blocks Go-http-client", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", "Go-http-client/2.0");
    expect(res.status).toBe(403);
  });

  it("blocks aiohttp", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", "Python/3.11 aiohttp/3.9.1");
    expect(res.status).toBe(403);
  });

  it("blocks httpx", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", "python-httpx/0.27.0");
    expect(res.status).toBe(403);
  });

  it("blocks AhrefsBot", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)");
    expect(res.status).toBe(403);
  });

  it("blocks SemrushBot", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)");
    expect(res.status).toBe(403);
  });

  it("blocks libwww-perl", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", "libwww-perl/6.68");
    expect(res.status).toBe(403);
  });

  it("blocks bare Python user-agent", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", "Python/3.12");
    expect(res.status).toBe(403);
  });

  it("blocks Java generic HTTP client", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", "Java/17.0.1");
    expect(res.status).toBe(403);
  });

  it("allows Safari mobile User-Agent", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    expect(res.status).not.toBe(403);
  });

  it("allows Firefox User-Agent", async () => {
    const res = await request(app)
      .get(PROBE)
      .set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0");
    expect(res.status).not.toBe(403);
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe("Auth rate limiting", () => {
  it("returns RateLimit-* headers on auth POST endpoints", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("User-Agent", BROWSER_UA)
      .send({ email: "probe@example.com", password: "wrongpassword" });
    // Regardless of auth outcome, rate-limit headers must be present
    expect(res.headers).toHaveProperty("ratelimit-limit");
    expect(res.headers).toHaveProperty("ratelimit-remaining");
  });

  it("returns RateLimit-* headers on general API endpoints", async () => {
    const res = await request(app)
      .get("/api/platform-config")
      .set("User-Agent", BROWSER_UA);
    expect(res.headers).toHaveProperty("ratelimit-limit");
    expect(res.headers).toHaveProperty("ratelimit-remaining");
  });
});
