/**
 * Hive Moderation AI-detection provider adapter.
 *
 * All results are ADVISORY ESTIMATES — they must never be treated as conclusive
 * proof that content is AI-generated. Moderators and admins must evaluate
 * results together with creator disclosures, project evidence, and platform policy.
 *
 * If HIVE_API_KEY is not set, all methods return a graceful "unavailable" result
 * and never fabricate scores.
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
 * Scan a publicly-accessible media URL using the Hive AI-generated content
 * detection API.
 *
 * Hive endpoint: POST https://api.thehive.ai/api/v2/task/sync
 * Docs: https://docs.thehive.ai/reference/ai-generated-content-detection
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
    const response = await fetch("https://api.thehive.ai/api/v2/task/sync", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ url: mediaUrl }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return {
        ...UNAVAILABLE,
        available: false,
        error: `Hive API error ${response.status}: ${response.statusText}`,
      };
    }

    const raw = (await response.json()) as Record<string, unknown>;

    // Parse Hive response — structure: { status: [{ response: { output: [...] } }] }
    const statusArr = raw["status"] as Array<Record<string, unknown>> | undefined;
    const firstStatus = statusArr?.[0];
    const responseObj = firstStatus?.["response"] as Record<string, unknown> | undefined;
    const outputArr = responseObj?.["output"] as Array<Record<string, unknown>> | undefined;

    // Hive AI-generated content classes include "ai_generated"
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
      modelVersion: "ai_generated_v1",
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
