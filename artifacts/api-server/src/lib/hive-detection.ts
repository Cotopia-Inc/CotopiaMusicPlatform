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
 * Body: { input: [{ media_url } | { media_base64 }], … }
 * Size limits: 200 MB per URL input, 20 MB base64, 60-second clip max per input item.
 *
 * Media-type behaviour differences:
 *   • IMAGE  — send URL directly (no duration limit applies).
 *   • AUDIO  — start_ms / end_ms supported; long files split into 60-second
 *              windows in a single multi-item request.
 *   • VIDEO  — start_ms / end_ms are NOT supported for video; the file must be
 *              ≤ 60 seconds itself. For longer videos we use ffmpeg (via the
 *              bundled ffmpeg-static binary) to extract and re-encode the first
 *              60 seconds, then send the clip as a base64-encoded data URI.
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

import { execFile } from "child_process";
import { accessSync, constants } from "fs";
import { readFile, writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { promisify } from "util";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

/**
 * Resolve the ffmpeg binary path and verify it is executable on this system.
 * Returns null when the package is absent or the binary can't be executed.
 */
function getFfmpegBinary(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bin = require("ffmpeg-static") as string | null;
    if (!bin) return null;
    // Verify the binary physically exists and is executable on this host.
    // This catches the case where pnpm installed the package but the binary
    // was stripped, has wrong permissions, or is for a different arch.
    accessSync(bin, constants.X_OK);
    return bin;
  } catch (err) {
    logger.warn({ err: String(err) }, "hive-detection: ffmpeg-static binary not executable");
    return null;
  }
}
const FFMPEG_BIN = getFfmpegBinary();
logger.info(
  { ffmpegBin: FFMPEG_BIN ?? "(not found / not executable)", ready: FFMPEG_BIN != null },
  "hive-detection: ffmpeg binary status",
);

/**
 * Extracts and re-encodes the first 60 seconds of a video using the bundled
 * ffmpeg binary. The clip is capped at 2 Mbps so the resulting MP4 stays well
 * under Hive's 20 MB base64 upload limit (60 s × 2 Mbps / 8 ≈ 15 MB).
 *
 * Download strategy: Node.js `fetch` downloads a capped slice of the video
 * (first 200 MB via HTTP Range). This keeps ffmpeg entirely off the network —
 * it reads a local temp file — which eliminates any Render loopback / TLS /
 * redirect issues that plagued the previous URL-input approach.
 *
 * 200 MB cap rationale: at 8 Mbps (HD) that is ~200 s of content; at 2 Mbps
 * (typical web video) it is ~800 s. We only ever need 60 s for Hive.
 *
 * Returns a Buffer containing the clip, or null on any failure (never throws).
 */
async function extractVideoClip60s(url: string): Promise<Buffer | null> {
  if (!FFMPEG_BIN) {
    logger.warn("hive-detection: ffmpeg binary unavailable; video clip extraction skipped");
    return null;
  }

  // Cap download at 200 MB — covers ≥60 s at any realistic web-video bitrate.
  const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;
  const inPath  = join(tmpdir(), `hive-in-${randomUUID()}.mp4`);
  const outPath = join(tmpdir(), `hive-clip-${randomUUID()}.mp4`);

  logger.info(
    { url: url.slice(0, 200), ffmpegBin: FFMPEG_BIN, maxMB: 200 },
    "hive-detection: downloading video for clip extraction",
  );

  try {
    // ── Step 1: download via Node.js fetch (no ffmpeg network access) ──────
    const dlResp = await fetch(url, {
      headers: { Range: `bytes=0-${MAX_DOWNLOAD_BYTES - 1}` },
      signal: AbortSignal.timeout(120_000),
    });

    // 200 OK (server ignores Range) or 206 Partial Content are both fine.
    if (!dlResp.ok && dlResp.status !== 206) {
      logger.error(
        { status: dlResp.status, url: url.slice(0, 200) },
        "hive-detection: video download failed — cannot extract clip",
      );
      return null;
    }

    const downloaded = Buffer.from(await dlResp.arrayBuffer());
    logger.info(
      { downloadedBytes: downloaded.length },
      "hive-detection: video downloaded; running ffmpeg",
    );
    await writeFile(inPath, downloaded);

    // ── Step 2: ffmpeg reads local file — no network needed ────────────────
    const { stderr } = await execFileAsync(FFMPEG_BIN, [
      "-loglevel", "error",             // only print real errors, no progress spam
      "-y",                             // overwrite without prompt
      "-i", inPath,                     // LOCAL temp file (no URL / no network)
      "-t", "60",                       // clip to first 60 seconds
      "-vf", "scale='min(1280,iw):-2'", // cap width at 1280 px, preserve aspect ratio
      "-b:v", "2M",                     // 2 Mbps → ≈15 MB for 60 s (< 20 MB Hive limit)
      "-b:a", "128k",                   // 128 kbps audio
      "-movflags", "+faststart",        // moov atom first for HTTP streaming
      outPath,
    ], { timeout: 120_000 });

    if (stderr) {
      logger.warn({ stderr: stderr.slice(0, 500) }, "hive-detection: ffmpeg stderr");
    }

    const buf = await readFile(outPath);
    logger.info(
      { clipBytes: buf.length },
      "hive-detection: ffmpeg clip extracted successfully",
    );
    return buf;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      { ffmpegBin: FFMPEG_BIN, url: url.slice(0, 200), detail: msg.slice(0, 1200) },
      "hive-detection: video clip extraction FAILED",
    );
    return null;
  } finally {
    await unlink(inPath).catch(() => undefined);
    await unlink(outPath).catch(() => undefined);
  }
}

/**
 * Returns diagnostic information about the ffmpeg binary on this host.
 * Used by the /api/ai/ffmpeg-status admin endpoint to verify production state.
 */
export async function getFFmpegStatus(): Promise<{
  binPath: string | null;
  ready: boolean;
  version: string | null;
  error: string | null;
}> {
  if (!FFMPEG_BIN) {
    return { binPath: null, ready: false, version: null, error: "binary not found or not executable" };
  }
  try {
    const { stdout, stderr } = await execFileAsync(FFMPEG_BIN, ["-version"], { timeout: 5_000 });
    const firstLine = (stdout || stderr || "").split("\n")[0].trim();
    return { binPath: FFMPEG_BIN, ready: true, version: firstLine || "(unknown)", error: null };
  } catch (err) {
    return {
      binPath: FFMPEG_BIN,
      ready: false,
      version: null,
      error: err instanceof Error ? err.message.slice(0, 300) : String(err),
    };
  }
}

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
 * Set `mediaType` to "video" for video files — the adapter will use ffmpeg to
 * extract a 60-second clip and send it as base64 (Hive does not support
 * start_ms/end_ms for video; the file must genuinely be ≤ 60 s).
 *
 * For "audio" (default), long content is split into up to MAX_SEGMENTS 60-second
 * windows using Hive's start_ms/end_ms parameters.
 *
 * Returns UNAVAILABLE when no API key is configured instead of fabricating data.
 */
export async function scanWithHive(
  mediaUrl: string,
  options?: {
    lowThreshold?: number;
    highThreshold?: number;
    criticalThreshold?: number;
    /** Duration of the media in seconds (from the DB). Used for audio chunking. */
    durationSeconds?: number;
    /**
     * Media type — controls how long content is handled.
     *   "video"  → ffmpeg clip extraction (start_ms/end_ms not supported for video)
     *   "audio"  → start_ms/end_ms time-window chunking (default)
     *   "image"  → single URL, no windowing
     */
    mediaType?: "audio" | "video" | "image";
  },
): Promise<HiveScanResult> {
  const apiKey = process.env.HIVE_API_KEY;
  if (!apiKey) return UNAVAILABLE;

  // ── Build segment input list ──────────────────────────────────────────────
  const SEGMENT_MS = 60_000;
  const MAX_SEGMENTS = 10; // up to 10 min of audio content per scan
  const durationMs = Math.round((options?.durationSeconds ?? 0) * 1000);
  const mediaType = options?.mediaType ?? "audio";

  // HiveInputItem accepts either a public URL or base64-encoded data.
  type HiveInputItem =
    | { media_url: string; start_ms?: number; end_ms?: number }
    | { media_base64: string };
  const inputItems: HiveInputItem[] = [];

  if (mediaType === "video") {
    // ── VIDEO ────────────────────────────────────────────────────────────────
    // Hive does NOT support start_ms/end_ms for video — the clip must genuinely
    // be ≤ 60 s. For long or unknown-duration videos, use ffmpeg to extract and
    // re-encode the first 60 seconds, then send as a base64 data URI.
    if (durationMs === 0 || durationMs > SEGMENT_MS) {
      const clip = await extractVideoClip60s(mediaUrl);
      if (clip) {
        inputItems.push({ media_base64: `data:video/mp4;base64,${clip.toString("base64")}` });
      } else {
        // ffmpeg unavailable or failed — send the URL directly and let Hive
        // return whatever error it returns (surfaced to the admin UI).
        inputItems.push({ media_url: mediaUrl });
      }
    } else {
      // Known short video (≤ 60 s) — send URL directly, no extraction needed.
      inputItems.push({ media_url: mediaUrl });
    }
  } else if (mediaType === "image") {
    // ── IMAGE ────────────────────────────────────────────────────────────────
    // No duration limit for images — single URL, no time params.
    inputItems.push({ media_url: mediaUrl });
  } else {
    // ── AUDIO (default) ──────────────────────────────────────────────────────
    // start_ms / end_ms are supported for audio. Long files split into 60-second
    // windows; unknown-duration audio sent as-is (Hive handles short clips fine).
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
      // Short or unknown-duration audio — single item.
      inputItems.push({ media_url: mediaUrl });
    }
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
        const lower = errText.toLowerCase();
        if (lower.includes("duration") || lower.includes("too large") || lower.includes("60")) {
          error = `Video is too long for the detection provider (max 60 s per segment). `
            + `Make sure the content has a duration recorded in the database so automatic chunking activates. `
            + `Detail: ${errText.slice(0, 200)}`;
        } else if (lower.includes("reachable") || lower.includes("fetch") || lower.includes("url")) {
          error = `Detection provider could not reach the media URL — ensure the file is publicly accessible. Detail: ${errText.slice(0, 200)}`;
        } else {
          error = `Detection provider rejected the file (400). Possible causes: URL not publicly reachable, file exceeds 200 MB, or unsupported format. Detail: ${errText.slice(0, 200)}`;
        }
      } else if (response.status === 413) {
        error = "Segment too large for detection provider (> 200 MB). Use a lower bitrate or shorter clip.";
      } else {
        error = `Detection provider error ${response.status}: ${errText.slice(0, 200)}`;
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
        // Hive V3 returns "value" in the classes array; the documented shape used "score".
        // Accept either field so both API versions work correctly.
        const classes = item["classes"] as Array<{ class: string; score?: number; value?: number }> | undefined;
        if (!Array.isArray(classes)) continue;
        for (const cls of classes) {
          const raw = typeof cls.score === "number" ? cls.score
            : typeof cls.value === "number" ? cls.value
            : null;
          if (raw === null) continue;
          // Match "ai_generated" exactly OR any "ai_generated_*" variant
          // (e.g. "ai_generated_audio", "ai_generated_voice") that Hive may
          // return for different media types. Worst-case: keep highest score.
          if (cls.class === "ai_generated" || cls.class.startsWith("ai_generated_")) {
            const pct = Math.round(raw * 100);
            if (aiScore === null || pct > aiScore) aiScore = pct;
          }
          if (raw > 0.5 && !indicators.includes(cls.class)) {
            indicators.push(cls.class);
          }
        }
      }

      // Fallback: some Hive endpoints only return the negative complement class
      // (e.g. "not_ai_generated"). Derive the positive score as 100 – complement.
      if (aiScore === null) {
        for (const item of outputArr) {
          const classes = item["classes"] as Array<{ class: string; score?: number; value?: number }> | undefined;
          if (!Array.isArray(classes)) continue;
          for (const cls of classes) {
            const raw = typeof cls.score === "number" ? cls.score
              : typeof cls.value === "number" ? cls.value
              : null;
            if (raw === null) continue;
            if (cls.class === "not_ai_generated" || cls.class.startsWith("not_ai_generated_")) {
              const pct = Math.round((1 - raw) * 100);
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
