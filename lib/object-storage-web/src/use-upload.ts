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
 * Upload strategy:
 *
 * Small files (< MULTIPART_THRESHOLD):
 *   1. Direct single-PUT via presigned URL (browser → R2 directly, fastest)
 *   2. Server-proxy fallback (browser → server → R2)
 *
 * Large files (≥ MULTIPART_THRESHOLD):
 *   1. Multipart direct upload — file is split into CHUNK_SIZE chunks, each
 *      chunk gets its own 1-hour presigned URL, browser PUTs all chunks
 *      directly to R2 in parallel batches, server finalises with CompleteMultipartUpload.
 *      This avoids single-connection timeouts on slow networks entirely.
 *   2. Single-PUT direct (fallback if multipart returns 501 / not configured)
 *   3. Server-proxy fallback (last resort)
 *
 * All paths retry on transient 5xx / network errors (up to MAX_AUTO_RETRIES).
 */

const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024;  // 100 MB
const CHUNK_SIZE_BYTES          =  50 * 1024 * 1024;  //  50 MB per chunk
const MAX_CONCURRENT_PARTS      = 3;                   // parallel chunk uploads

const MAX_AUTO_RETRIES = 2; // 3 total attempts
const RETRY_DELAY_MS = [1000, 3000];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(err: Error & { status?: number }): boolean {
  return err.status == null || err.status >= 500;
}

// ---------------------------------------------------------------------------
// Single-PUT direct upload
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Server-proxy upload (fallback)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Multipart direct upload (large files)
// ---------------------------------------------------------------------------

interface MultipartStartResponse {
  uploadId: string;
  objectPath: string;
  partUrls: string[];
  metadata: UploadMetadata;
}

/**
 * PUT a single chunk to R2 using a presigned URL. Returns the ETag from the
 * response header — R2 always includes this (with surrounding quotes) which
 * is exactly what CompleteMultipartUpload expects.
 *
 * `onLoaded` receives the total bytes loaded so far for this chunk so the
 * caller can aggregate progress across parallel parts.
 */
function uploadPart(
  url: string,
  chunk: Blob,
  onLoaded: (loadedBytes: number) => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onLoaded(e.loaded);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag =
          xhr.getResponseHeader("ETag") ??
          xhr.getResponseHeader("etag") ??
          "";
        resolve(etag);
      } else {
        const err = new Error(`Part upload failed (${xhr.status})`) as Error & { status?: number };
        err.status = xhr.status;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error("Part upload network error"));
    xhr.onabort = () => reject(new Error("Part upload cancelled"));

    xhr.send(chunk);
  });
}

/**
 * Multipart direct upload:
 *  1. Ask the server to create an R2 multipart upload and presign all part URLs
 *  2. PUT each 50 MB chunk directly to R2 (MAX_CONCURRENT_PARTS in parallel)
 *  3. Tell the server to call CompleteMultipartUpload with the ordered ETag list
 *
 * Each part URL is valid for 1 hour — even a very slow connection won't expire
 * a 50 MB chunk's URL before the chunk finishes uploading.
 * If any part fails, the upload is aborted (best-effort) to free R2 storage.
 */
async function attemptMultipartDirectUpload(
  basePath: string,
  file: File,
  authHeaders: Record<string, string>,
  onProgress: (pct: number) => void,
): Promise<UploadResponse> {
  const partCount = Math.ceil(file.size / CHUNK_SIZE_BYTES);

  // 1. Initiate and get all presigned part URLs
  const startRes = await fetch(`${basePath}/uploads/multipart/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
      partCount,
    }),
  });

  if (!startRes.ok) {
    const err = new Error(`Multipart start failed (${startRes.status})`) as Error & { status?: number };
    err.status = startRes.status;
    throw err;
  }

  const { uploadId, objectPath, partUrls, metadata }: MultipartStartResponse =
    await startRes.json();

  // 2. Upload parts in parallel batches; track per-part loaded bytes for accurate progress
  const partBytesLoaded = new Array<number>(partCount).fill(0);
  const parts: Array<{ partNumber: number; etag: string }> = [];

  const updateProgress = () => {
    const loaded = partBytesLoaded.reduce((a, b) => a + b, 0);
    onProgress(Math.min(94, Math.round((loaded / file.size) * 94)));
  };

  try {
    for (let batchStart = 0; batchStart < partCount; batchStart += MAX_CONCURRENT_PARTS) {
      const batchIndices = Array.from(
        { length: Math.min(MAX_CONCURRENT_PARTS, partCount - batchStart) },
        (_, i) => batchStart + i,
      );

      const batchResults = await Promise.all(
        batchIndices.map(async (partIndex) => {
          const partNumber = partIndex + 1;
          const start = partIndex * CHUNK_SIZE_BYTES;
          const chunk = file.slice(start, Math.min(start + CHUNK_SIZE_BYTES, file.size));

          const etag = await uploadPart(partUrls[partIndex], chunk, (loaded) => {
            partBytesLoaded[partIndex] = loaded;
            updateProgress();
          });

          return { partNumber, etag };
        }),
      );

      parts.push(...batchResults);
    }
  } catch (partError) {
    // Best-effort abort — frees the in-progress R2 multipart upload storage
    fetch(`${basePath}/uploads/multipart/abort`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ objectPath, uploadId }),
    }).catch(() => { /* ignore abort errors */ });
    throw partError;
  }

  // 3. Complete — R2 assembles all parts into the final object
  onProgress(95);
  parts.sort((a, b) => a.partNumber - b.partNumber);

  const completeRes = await fetch(`${basePath}/uploads/multipart/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ objectPath, uploadId, parts, metadata }),
  });

  if (!completeRes.ok) {
    const err = new Error(`Multipart complete failed (${completeRes.status})`) as Error & { status?: number };
    err.status = completeRes.status;
    throw err;
  }

  return { uploadURL: "", objectPath, metadata };
}

// ---------------------------------------------------------------------------
// Unified attempt — picks the right strategy per file size
// ---------------------------------------------------------------------------

async function attemptUpload(
  basePath: string,
  file: File,
  authHeaders: Record<string, string>,
  onProgress: (pct: number) => void,
): Promise<UploadResponse> {
  // Large files: try chunked multipart direct upload first.
  // Each 50 MB chunk has its own 1-hour presigned URL so no expiry risk even
  // on very slow connections. Falls through on 501 (not configured) or errors.
  if (file.size >= MULTIPART_THRESHOLD_BYTES) {
    try {
      return await attemptMultipartDirectUpload(basePath, file, authHeaders, onProgress);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      // 4xx other than 501 are hard failures (bad request, auth) — don't fall through
      if (status != null && status !== 501 && status >= 400 && status < 500) throw err;
      onProgress(0);
    }
  }

  // Small files (or multipart not configured): direct single-PUT → proxy fallback
  try {
    return await attemptDirectUpload(basePath, file, authHeaders, onProgress);
  } catch {
    onProgress(0);
    return attemptProxyUpload(basePath, file, authHeaders, onProgress);
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

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
