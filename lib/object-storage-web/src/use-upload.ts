import { useState, useCallback, useRef } from "react";
import type { UppyFile } from "@uppy/core";

export interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

export interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: UploadMetadata;
}

export interface UseUploadOptions {
  /** Base path where object storage routes are mounted (default: "/api/storage") */
  basePath?: string;
  /**
   * Returns extra headers (e.g. `Authorization`) to attach to upload
   * requests. Both `/uploads/upload` and `/uploads/request-url` require
   * auth, so callers whose backend enforces auth on these routes must
   * supply this.
   */
  getAuthHeaders?: () => Record<string, string>;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Two-step direct-to-storage upload, with automatic fallback to the
 * server-proxied route:
 *
 *   1. POST {basePath}/uploads/request-url — ask the server for a presigned
 *      PUT URL (GCS signed URL, or R2 S3-compatible presign).
 *   2. PUT the raw file bytes straight to that URL — the bytes never touch
 *      the API server, so this is roughly 2x faster than proxying through
 *      the server and doesn't consume server bandwidth/CPU at all.
 *
 * If either step fails for ANY reason (backend doesn't support direct
 * upload yet, expired/misconfigured URL, CORS misconfiguration, network
 * error), this transparently falls back to the server-proxy route
 * (POST {basePath}/uploads/upload with the raw bytes) — this makes direct
 * upload a pure speed optimization that can never break uploads outright.
 *
 * Large uploads can hit transient network errors or a 5xx mid-transfer.
 * Rather than surfacing that as an immediate failure, this hook
 * automatically retries a few times with backoff before giving up.
 */

const MAX_AUTO_RETRIES = 2; // 3 total attempts
const RETRY_DELAY_MS = [1000, 3000];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(err: Error & { status?: number }): boolean {
  // Retry on network errors (no status) or server errors (5xx).
  // Never retry on 4xx — those are permanent (bad request, too large, etc).
  return err.status == null || err.status >= 500;
}

async function requestPresignedUrl(
  basePath: string,
  file: File,
  authHeaders: Record<string, string>,
): Promise<UploadResponse> {
  const response = await fetch(`${basePath}/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });

  if (!response.ok) {
    const err = new Error(`Failed to get upload URL (${response.status})`) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  return (await response.json()) as UploadResponse;
}

function xhrPut(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.min(95, Math.round((e.loaded / e.total) * 95)));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        const err = new Error(`Direct upload failed (${xhr.status})`) as Error & { status?: number };
        err.status = xhr.status;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error("Direct upload network error"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    xhr.send(file);
  });
}

async function attemptDirectUpload(
  basePath: string,
  file: File,
  authHeaders: Record<string, string>,
  onProgress: (pct: number) => void,
): Promise<UploadResponse> {
  const { uploadURL, objectPath, metadata } = await requestPresignedUrl(basePath, file, authHeaders);

  await xhrPut(uploadURL, file, file.type || "application/octet-stream", onProgress);

  return {
    uploadURL,
    objectPath,
    metadata: metadata ?? { name: file.name, size: file.size, contentType: file.type || "application/octet-stream" },
  };
}

function attemptProxyUpload(
  basePath: string,
  file: File,
  authHeaders: Record<string, string>,
  onProgress: (pct: number) => void,
): Promise<UploadResponse> {
  return new Promise<UploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${basePath}/uploads/upload`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    for (const [key, value] of Object.entries(authHeaders)) {
      xhr.setRequestHeader(key, value);
    }

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

async function attemptUpload(
  basePath: string,
  file: File,
  authHeaders: Record<string, string>,
  onProgress: (pct: number) => void,
): Promise<UploadResponse> {
  try {
    return await attemptDirectUpload(basePath, file, authHeaders, onProgress);
  } catch {
    // Direct upload isn't available or failed for this backend/URL — fall
    // back to the reliable server-proxy path. Reset progress since the
    // failed direct attempt may have made partial progress.
    onProgress(0);
    return attemptProxyUpload(basePath, file, authHeaders, onProgress);
  }
}

/**
 * React hook for handling file uploads.
 */
export function useUpload(options: UseUploadOptions = {}) {
  const basePath = options.basePath ?? "/api/storage";
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      const authHeaders = optionsRef.current.getAuthHeaders?.() ?? {};
      let lastError: Error = new Error("Upload failed");

      for (let attempt = 0; attempt <= MAX_AUTO_RETRIES; attempt++) {
        try {
          if (attempt > 0) setProgress(0);
          const result = await attemptUpload(basePath, file, authHeaders, setProgress);
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
    },
    [basePath],
  );

  const getUploadParameters = useCallback(
    async (
      file: UppyFile<Record<string, unknown>, Record<string, unknown>>
    ): Promise<{
      method: "PUT";
      url: string;
      headers?: Record<string, string>;
    }> => {
      const authHeaders = optionsRef.current.getAuthHeaders?.() ?? {};
      const response = await fetch(`${basePath}/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const data = (await response.json()) as { uploadURL: string };
      return {
        method: "PUT",
        url: data.uploadURL,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      };
    },
    [basePath]
  );

  return {
    uploadFile,
    getUploadParameters,
    isUploading,
    error,
    progress,
  };
}
