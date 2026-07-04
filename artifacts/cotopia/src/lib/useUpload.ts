import { useState, useCallback, useRef } from "react";

export interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: { name: string; size: number; contentType: string };
}

interface UseUploadOptions {
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Single-step server-proxy upload:
 *   POST /api/storage/uploads/upload with the raw file bytes.
 *   The server receives the stream, pushes it to GCS, and returns objectPath.
 *
 * This avoids direct browser→GCS PUT (which has cross-origin issues in some
 * browser environments) and gives accurate upload progress via XHR.
 *
 * No product-level size cap right now (creators upload large "one take"
 * videos). The Express route uses express.raw({ limit: "10gb" }) as a
 * technical safety ceiling — not a real-world limit. The Replit reverse
 * proxy passes large bodies through fine.
 *
 * Large uploads (e.g. multi-hundred-MB videos on a flaky connection) can hit
 * transient network errors or a 5xx from the storage backend mid-transfer.
 * Rather than surfacing that as an immediate failure, this hook automatically
 * retries a few times with backoff before giving up — the user still sees a
 * manual "Retry" button if all automatic attempts are exhausted.
 */

const MAX_AUTO_RETRIES = 2; // 3 total attempts
const RETRY_DELAY_MS = [1000, 3000];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function attemptUpload(file: File, onProgress: (pct: number) => void): Promise<UploadResponse> {
  return new Promise<UploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/storage/uploads/upload");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.min(95, Math.round((e.loaded / e.total) * 95)));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResponse);
        } catch {
          const err = new Error("Invalid server response") as Error & { status?: number };
          err.status = xhr.status;
          reject(err);
        }
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText) as { error?: string };
          if (body.error) msg = body.error;
        } catch { /* ignore */ }
        const err = new Error(msg) as Error & { status?: number };
        err.status = xhr.status;
        reject(err);
      }
    };

    xhr.onerror = () => {
      const err = new Error("Network error — check your connection and try again") as Error & { status?: number };
      err.status = null as unknown as number;
      reject(err);
    };
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    xhr.send(file);
  });
}

function isRetryable(err: Error & { status?: number }): boolean {
  // Retry on network errors (no status) or server errors (5xx).
  // Never retry on 4xx — those are permanent (bad request, too large, etc).
  return err.status == null || err.status >= 500;
}

export function useUpload(options: UseUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const uploadFile = useCallback(async (file: File): Promise<UploadResponse | null> => {
    setIsUploading(true);
    setError(null);
    setProgress(0);

    let lastError: Error = new Error("Upload failed");

    for (let attempt = 0; attempt <= MAX_AUTO_RETRIES; attempt++) {
      try {
        if (attempt > 0) setProgress(0);
        const result = await attemptUpload(file, setProgress);
        setProgress(100);
        optionsRef.current.onSuccess?.(result);
        setIsUploading(false);
        return result;
      } catch (err) {
        const uploadError = err instanceof Error ? err : new Error("Upload failed");
        lastError = uploadError;
        const canRetry = attempt < MAX_AUTO_RETRIES && isRetryable(uploadError as Error & { status?: number });
        if (!canRetry) break;
        await sleep(RETRY_DELAY_MS[attempt] ?? 3000);
      }
    }

    setError(lastError);
    optionsRef.current.onError?.(lastError);
    setIsUploading(false);
    return null;
  }, []);

  return { uploadFile, isUploading, error, progress };
}
