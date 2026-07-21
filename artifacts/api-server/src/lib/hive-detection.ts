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
 * Body: { input: [{ media_url: "<public URL>" }] }
 * Size limits: 200 MB via public URL, 20 MB via base64, 60-second video clip max.
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

export interface HiveScanResult {
  available: boolean;
  provider: string;
  modelVersion: string | null;
  aiLikelihoodPercent: number | null;   // 0–100 estimated AI likelihood
  confidenceLevel: "unavailable" | "low" | "medium" | "high";
  riskLevel: "low" | "moderate" | "high" | "critical" | null;
  detectionIndicators: string[];
  rawResult: Record<string, unknown> | null;
  error: string | null;
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
};

/**
 * Scan a publicly-accessible media URL using the Hive V3 AI-generated content
 * detection API.
 *
 * Supports files up to 200 MB via public URL (our R2/GCS URLs qualify).
 * Timeout is 120 seconds to accommodate Hive fetching and processing large files.
 *
 * Returns UNAVAILABLE when no API key is configured instead of fabricating data.
 */
export async function scanWithHive(
  mediaUrl: string,
  options?: { lowThreshold?: number; highThreshold?: number; criticalThreshold?: number },
): Promise<HiveScanResult> {
  const apiKey = process.env.HIVE_API_KEY;
  if (!apiKey) return UNAVAILABLE;

  try {
    const response = await fetch(
      "https://api.thehive.ai/api/v3/hive/ai-generated-and-deepfake-content-detection",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ input: [{ media_url: mediaUrl }] }),
        // 120 s: Hive must fetch + process files up to 200 MB on their end.
        signal: AbortSignal.timeout(120_000),
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      return {
        ...UNAVAILABLE,
        available: false,
        error: `Hive API error ${response.status}: ${errText}`,
      };
    }

    const raw = (await response.json()) as Record<string, unknown>;

    // Extract model version from top-level "model" field if present.
    const modelVersion =
      typeof raw["model"] === "string"
        ? raw["model"]
        : "ai-generated-and-deepfake-content-detection-v3";

    // Parse V3 response — structure: { status: [{ response: { output: [...] } }] }
    // Each output item has a "classes" array of { class: string, score: number }.
    const statusArr = raw["status"] as Array<Record<string, unknown>> | undefined;
    const firstStatus = statusArr?.[0];
    const responseObj = firstStatus?.["response"] as Record<string, unknown> | undefined;
    const outputArr = responseObj?.["output"] as Array<Record<string, unknown>> | undefined;

    let aiScore: number | null = null;
    const indicators: string[] = [];

    if (Array.isArray(outputArr)) {
      for (const item of outputArr) {
        const classes = item["classes"] as Array<{ class: string; score: number }> | undefined;
        if (!Array.isArray(classes)) continue;
        for (const cls of classes) {
          if (cls.class === "ai_generated" && typeof cls.score === "number") {
            aiScore = Math.round(cls.score * 100);
          }
          if (cls.score > 0.5) {
            indicators.push(cls.class);
          }
        }
      }
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
    };
  } catch (err) {
    return {
      ...UNAVAILABLE,
      available: false,
      error: err instanceof Error ? err.message : "Unknown scan error",
    };
  }
}
