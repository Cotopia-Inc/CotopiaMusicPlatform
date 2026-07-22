/**
 * Hive Moderation AI-detection provider adapter — V3 API.
 *
 * All results are ADVISORY ESTIMATES — they must never be treated as conclusive
 * proof that content is AI-generated. Moderators and admins must evaluate
 * results together with creator disclosures, project evidence, and platform policy.
 *
 * If HIVE_API_KEY is not set, all methods return a graceful "unavailable" result
 * and never fabricate scores.
 *
 * V3 API endpoint: POST https://api.thehive.ai/api/v3/hive/ai-generated-and-deepfake-content-detection
 * Auth: Bearer <key>
 * Body: { input: [{ media_url, start_ms?, end_ms? }, …] }
 * Size limits: 200 MB per URL input, 20 MB base64, 60-second clip max per input item.
 *
 * Long files (> 60 s): split into multiple 60-second input items (same URL, different
 * time windows). Hive processes each segment independently and returns one output per
 * input in status[0].response.output[]. We take the worst-case (max) ai_generated
 * score across all segments.
 *
 * Representative V3 response shape (for reference / offline testing):
 * {
 *   "id": "task_abc123",
 *   "model": "ai-generated-and-deepfake-content-detection",
 *   "status": [
 *     {
 *       "response": {
 *         "output": [
 *           {
 *             "time": 0,
 *             "duration": null,
 *             "classes": [
 *               { "class": "ai_generated",     "score": 0.987 },
 *               { "class": "not_ai_generated", "score": 0.013 }
 *             ]
 *           }
 *         ]
 *       }
 *     }
 *   ]
 * }
 */

import { logger } from "./logger";

export interface HiveScanResult {
  available: boolean;
  provider: string;
  modelVersion: string | null;
  aiLikelihoodPercent: number | null;   // 0–100 worst-case across all segments
  confidenceLevel: "unavailable" | "low" | "medium" | "high";
  riskLevel: "low" | "moderate" | "high" | "critical" | null;
  detectionIndicators: string[];
  rawResult: Record<string, unknown> | null;
  error: string | null;
  segmentsScanned: number;              // 1 for short content, N for chunked scans
}

/** Compute risk level from a 0-100 score (matches spec thresholds). */
export function scoreToRiskLevel(
  percent: number,
  low = 25,
  high = 60,
  critical = 90,
): "low" | "moderate" | "high" | "critical" {
  if (percent < low) return "low";
  if (percent < high) return "moderate";
  if (percent < critical) return "high";
  return "critical";
}

/** Graceful no-key result — never returns fake scores. */
const UNAVAILABLE: HiveScanResult = {
  available: false,
  provider: "hive",
  modelVersion: null,
  aiLikelihoodPercent: null,
  confidenceLevel: "unavailable",
  riskLevel: null,
  detectionIndicators: [],
  rawResult: null,
  error: null,
  segmentsScanned: 0,
};

/**
 * Scan a publicly-accessible media URL using the Hive V3 AI-generated content
 * detection API.
 *
 * Long content (> 60 s) is automatically split into up to MAX_SEGMENTS segments
 * of 60 s each using Hive's start_ms / end_ms parameters. All segments are sent
 * in a single HTTP request. The final aiLikelihoodPercent is the worst-case
 * (highest) score across all segments.
 *
 * Pass durationSeconds from the DB record so the adapter can build the correct
 * segment list without probing the file. A value of 0 or undefined causes the
 * adapter to send the full URL as a single input item (Hive handles it if short).
 *
 * Returns UNAVAILABLE when no API key is configured instead of fabricating data.
 */
export async function scanWithHive(
  mediaUrl: string,
  options?: {
    lowThreshold?: number;
    highThreshold?: number;
    criticalThreshold?: number;
    /** Duration of the media in seconds (from the DB). Required for chunked scanning. */
    durationSeconds?: number;
  },
): Promise<HiveScanResult> {
  const apiKey = process.env.HIVE_API_KEY;
  if (!apiKey) return UNAVAILABLE;

  // ── Build segment input list ──────────────────────────────────────────────
  // Hive enforces a 60-second clip limit per input item.
  // For content > 60 s, split into multiple time-range items from the same URL.
  const SEGMENT_MS = 60_000;
  const MAX_SEGMENTS = 10; // up to 10 min of content per scan
  const durationMs = Math.round((options?.durationSeconds ?? 0) * 1000);

  type HiveInputItem = { media_url: string; start_ms?: number; end_ms?: number };
  const inputItems: HiveInputItem[] = [];

  if (durationMs > SEGMENT_MS) {
    let offset = 0;
    let count = 0;
    while (offset < durationMs && count < MAX_SEGMENTS) {
      inputItems.push({
        media_url: mediaUrl,
        start_ms: offset,
        end_ms: Math.min(offset + SEGMENT_MS, durationMs),
      });
      offset += SEGMENT_MS;
      count++;
    }
  } else {
    // Short file — single item with no time params so Hive can infer boundaries.
    inputItems.push({ media_url: mediaUrl });
  }

  try {
    // Allow more time for multi-segment requests (120 s per segment, capped at 5 min).
    const timeoutMs = Math.min(120_000 * inputItems.length, 300_000);

    logger.info(
      { segments: inputItems.length, firstUrl: mediaUrl.slice(0, 200) },
      "hive-detection: sending scan request",
    );

    const response = await fetch(
      "https://api.thehive.ai/api/v3/hive/ai-generated-and-deepfake-content-detection",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ input: inputItems }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      let error: string;
      if (response.status === 400) {
        // 400 is usually "clip too long" or "URL not reachable" — give actionable message.
        error = `Hive rejected the file (400). Possible causes: URL not publicly reachable, clip exceeds 200 MB, or unsupported format. Detail: ${errText.slice(0, 300)}`;
      } else if (response.status === 413) {
        error = "Segment too large for Hive (> 200 MB). Use a lower bitrate or shorter clip.";
      } else {
        error = `Hive API error ${response.status}: ${errText.slice(0, 300)}`;
      }
      return { ...UNAVAILABLE, available: false, error };
    }

    const raw = (await response.json()) as Record<string, unknown>;

    const modelVersion =
      typeof raw["model"] === "string"
        ? raw["model"]
        : "ai-generated-and-deepfake-content-detection-v3";

    // ── Aggregate across ALL output items (one per segment) ────────────────
    // Take the WORST-CASE (max) ai_generated score — the most conservative
    // approach for content policy enforcement.
    const statusArr = raw["status"] as Array<Record<string, unknown>> | undefined;
    const firstStatus = statusArr?.[0];
    const responseObj = firstStatus?.["response"] as Record<string, unknown> | undefined;
    const outputArr = responseObj?.["output"] as Array<Record<string, unknown>> | undefined;

    let aiScore: number | null = null;
    const indicators: string[] = [];
    const segmentsScanned = Array.isArray(outputArr) ? outputArr.length : 0;

    if (Array.isArray(outputArr)) {
      for (const item of outputArr) {
        const classes = item["classes"] as Array<{ class: string; score: number }> | undefined;
        if (!Array.isArray(classes)) continue;
        for (const cls of classes) {
          // Match "ai_generated" exactly OR any "ai_generated_*" variant
          // (e.g. "ai_generated_audio", "ai_generated_voice") that Hive may
          // return for different media types. Worst-case: keep highest score.
          if (
            (cls.class === "ai_generated" || cls.class.startsWith("ai_generated_")) &&
            typeof cls.score === "number"
          ) {
            const pct = Math.round(cls.score * 100);
            if (aiScore === null || pct > aiScore) aiScore = pct;
          }
          if (cls.score > 0.5 && !indicators.includes(cls.class)) {
            indicators.push(cls.class);
          }
        }
      }

      // Fallback: some Hive endpoints only return the negative complement class
      // (e.g. "not_ai_generated"). Derive the positive score as 100 – complement.
      if (aiScore === null) {
        for (const item of outputArr) {
          const classes = item["classes"] as Array<{ class: string; score: number }> | undefined;
          if (!Array.isArray(classes)) continue;
          for (const cls of classes) {
            if (
              (cls.class === "not_ai_generated" || cls.class.startsWith("not_ai_generated_")) &&
              typeof cls.score === "number"
            ) {
              const pct = Math.round((1 - cls.score) * 100);
              if (aiScore === null || pct > aiScore) aiScore = pct;
            }
          }
        }
      }
    }

    // Log the full Hive response when no score could be extracted — this surfaces
    // in server logs (Render) and reveals the actual response shape for debugging.
    if (aiScore === null) {
      logger.warn(
        {
          outputItems: segmentsScanned,
          firstOutputItem: Array.isArray(outputArr) ? outputArr[0] : undefined,
          rawKeys: Object.keys(raw),
          statusKeys: Array.isArray(statusArr) && statusArr[0]
            ? Object.keys(statusArr[0])
            : [],
          responseKeys: responseObj ? Object.keys(responseObj) : [],
        },
        "hive-detection: scan complete but no ai_generated score extracted — check response shape",
      );
    } else {
      logger.info(
        { aiScore, segments: segmentsScanned, indicators },
        "hive-detection: scan complete",
      );
    }

    const low = options?.lowThreshold ?? 25;
    const high = options?.highThreshold ?? 60;
    const critical = options?.criticalThreshold ?? 90;

    const risk = aiScore !== null ? scoreToRiskLevel(aiScore, low, high, critical) : null;

    let confidence: HiveScanResult["confidenceLevel"] = "unavailable";
    if (aiScore !== null) {
      if (aiScore >= 80 || aiScore <= 20) confidence = "high";
      else if (aiScore >= 60 || aiScore <= 40) confidence = "medium";
      else confidence = "low";
    }

    return {
      available: true,
      provider: "hive",
      modelVersion,
      aiLikelihoodPercent: aiScore,
      confidenceLevel: confidence,
      riskLevel: risk,
      detectionIndicators: indicators,
      rawResult: raw,
      error: null,
      segmentsScanned,
    };
  } catch (err) {
    return {
      ...UNAVAILABLE,
      available: false,
      error: err instanceof Error ? err.message : "Unknown scan error",
    };
  }
}
