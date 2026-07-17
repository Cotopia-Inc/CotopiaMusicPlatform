import type { Request, Response, NextFunction } from "express";

/**
 * Known automated scraper / headless-client User-Agent patterns.
 * These are NOT real browsers and have no legitimate reason to hit
 * a private streaming API that requires authentication.
 *
 * Patterns are intentionally broad substrings/prefixes so minor
 * version bumps in scraping libraries don't slip through.
 */
const BLOCKED_UA_PATTERNS: RegExp[] = [
  /python-requests/i,
  /scrapy/i,
  /libwww-perl/i,
  /\bwget\b/i,
  /aiohttp/i,
  /\bhttpx\b/i,
  /Go-http-client/i,
  /java\/\d/i,
  /\bmechanize\b/i,
  /python-urllib/i,
  /\bpython\b\/\d/i,
  /\bcurl\/\d/i,
  /\blynx\//i,
  /\bhttrack\b/i,
  /\bnuxtlink\b/i,
  /SemrushBot/i,
  /AhrefsBot/i,
  /MJ12bot/i,
  /DotBot/i,
  /PetalBot/i,
];

/**
 * Bot-detection middleware.
 *
 * Applied before rate-limiting on all /api routes so known scrapers
 * never consume a rate-limit slot or reach any route handler.
 *
 * Rules:
 *   1. Missing / empty User-Agent → 403 (real browsers always send one)
 *   2. Matches a BLOCKED_UA_PATTERNS entry → 403
 *   3. Otherwise → pass through
 *
 * Returns a generic "Forbidden" body so attackers cannot distinguish
 * between "blocked as a bot" and "blocked for another reason".
 */
export function botDetection(req: Request, res: Response, next: NextFunction): void {
  const ua = (req.headers["user-agent"] ?? "").trim();

  if (!ua) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  for (const pattern of BLOCKED_UA_PATTERNS) {
    if (pattern.test(ua)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  next();
}
