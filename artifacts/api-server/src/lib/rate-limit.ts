import rateLimit from "express-rate-limit";

const RATE_LIMIT_MESSAGE = { error: "Too many requests. Please slow down and try again later." };

/**
 * Strict limit on auth mutation endpoints (login, register, password reset).
 * Prevents credential brute-force and account enumeration.
 * 10 attempts per IP per 15-minute window.
 *
 * IP resolution uses Express's req.ip, which reflects the real client IP once
 * app.set("trust proxy", 1) is set (picking up X-Forwarded-For from Render).
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-6",
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
});

/**
 * General API rate limit applied to all /api routes.
 * 300 requests per IP per 15-minute window (~1 req/3 s sustained).
 * Generous enough for normal interactive use; throttles automated scrapers.
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: "draft-6",
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
});
