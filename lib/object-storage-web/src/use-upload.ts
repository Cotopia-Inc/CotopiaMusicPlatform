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
  basePath?: string;
  getAuthHeaders?: () => Record<string, string>;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Upload strategy
 * ───────────────
 * Small files (< MULTIPART_THRESHOLD):
 *   1. Direct single-PUT via presigned URL (browser → R2, fastest)
 *   2. Server-proxy fallback (browser → server → R2 REST API)
 *
 * Large files (≥ MULTIPART_THRESHOLD):
 *   1. Server-side S3 multipart — file is split into CHUNK_SIZE chunks; each
 *      chunk is POSTed to /multipart/part where the server uploads it to R2
 *      via UploadPartCommand. No CORS configuration on the R2 bucket required;
 *      no browser↔R2 direct connection. Returns 501 when R2 S3 credentials
 *      are not configured, falls through to the single-PUT paths below.
 *   2. Direct single-PUT via presigned URL (fallback)
 *   3. Server-proxy fallback (last resort, fails for very large files if
 *      Cloudflare is in the request path and imposes a body-size limit)
 */

const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024; //  100 MB
const CHUNK_SIZE_BYTES          =  50 * 1024 * 1024; //   50 MB per chunk

const MAX_AUTO_RETRIES = 2;
const RETRY_DELAY_MS   = [1000, 3000];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(err: Error & { status?: number }): boolean {
  if (err.status == null) return true;  // network error — worth one retry
  if (err.status === 501) return false; // not configured — retrying won't help
  return err.status >= 500;             // 5xx server errors; 4xx are never retried
}

// ---------------------------------------------------------------------------
// Single-PUT direct upload
// ---------------------------------------------------------------------------

async function requestPresignedUrl(
  basePath: string,
  file: File,
  authHeaders: Record<string, string>,
): Promise<UploadResponse> {
  const res = await fetch(`${basePath}/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });
  if (!res.ok) {
    const err = new Error(`Failed to get upload URL (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as UploadResponse;
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
      if (e.lengthComputable) onProgress(Math.min(95, Math.round((e.loaded / e.total) * 95)));
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
// Server-proxy upload (fallback for small files)
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
      if (e.lengthComputable) onProgress(Math.min(95, Math.round((e.loaded / e.total) * 95)));
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
// Server-side S3 multipart upload (large files)
// ---------------------------------------------------------------------------

/**
 * POST one binary chunk to the server's /multipart/part endpoint using XHR so
 * we get upload-progress events. The server buffers the chunk and calls
 * UploadPartCommand — no direct browser↔R2 connection needed.
 *
 * Returns the ETag string from the JSON response body (as returned by R2).
 */
function uploadChunkToServer(
  basePath: string,
  objectPath: string,
  uploadId: string,
  partNumber: number,
  chunk: Blob,
  authHeaders: Record<string, string>,
  onLoaded: (bytes: number) => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${basePath}/uploads/multipart/part`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-Object-Path", objectPath);
    xhr.setRequestHeader("X-Upload-Id", uploadId);
    xhr.setRequestHeader("X-Part-Number", String(partNumber));
    for (const [key, value] of Object.entries(authHeaders)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onLoaded(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { etag: string };
          resolve(data.etag);
        } catch {
          reject(new Error("Invalid part response"));
        }
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
 * Server-side S3 multipart upload:
 *  1. POST /multipart/start  — server creates the R2 multipart upload
 *  2. POST /multipart/part   — for each 50 MB chunk (sequential; server→R2 via S3 SDK)
 *  3. POST /multipart/complete — server calls CompleteMultipartUpload
 *
 * Falls through (throws with status 501) if R2 S3 credentials are not set in
 * the server environment, so the caller can fall back to the single-PUT paths.
 */
async function attemptMultipartServerUpload(
  basePath: string,
  file: File,
  authHeaders: Record<string, string>,
  onProgress: (pct: number) => void,
): Promise<UploadResponse> {
  // 1. Initiate
  const startRes = await fetch(`${basePath}/uploads/multipart/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });

  if (!startRes.ok) {
    const err = new Error(`Multipart start failed (${startRes.status})`) as Error & { status?: number };
    err.status = startRes.status;
    throw err;
  }

  const { uploadId, objectPath, metadata } = (await startRes.json()) as {
    uploadId: string;
    objectPath: string;
    metadata: UploadMetadata;
  };

  const partCount = Math.ceil(file.size / CHUNK_SIZE_BYTES);
  const parts: Array<{ partNumber: number; etag: string }> = [];
  let uploadedBytes = 0;

  // 2. Upload chunks sequentially (server buffers each, uploads to R2 via S3 SDK)
  try {
    for (let i = 0; i < partCount; i++) {
      const partNumber = i + 1;
      const start = i * CHUNK_SIZE_BYTES;
      const chunk = file.slice(start, Math.min(start + CHUNK_SIZE_BYTES, file.size));

      const etag = await uploadChunkToServer(
        basePath,
        objectPath,
        uploadId,
        partNumber,
        chunk,
        authHeaders,
        (loaded) => {
          onProgress(Math.min(94, Math.round(((uploadedBytes + loaded) / file.size) * 94)));
        },
      );

      uploadedBytes += chunk.size;
      parts.push({ partNumber, etag });
      onProgress(Math.min(94, Math.round((uploadedBytes / file.size) * 94)));
    }
  } catch (partError) {
    // Best-effort abort — frees the in-progress R2 multipart upload
    fetch(`${basePath}/uploads/multipart/abort`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ objectPath, uploadId }),
    }).catch(() => { /* ignore */ });
    throw partError;
  }

  // 3. Complete
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
// Unified upload strategy
// ---------------------------------------------------------------------------

async function attemptUpload(
  basePath: string,
  file: File,
  authHeaders: Record<string, string>,
  onProgress: (pct: number) => void,
): Promise<UploadResponse> {
  let multipartUnavailable = false;

  if (file.size >= MULTIPART_THRESHOLD_BYTES) {
    try {
      return await attemptMultipartServerUpload(basePath, file, authHeaders, onProgress);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 501) {
        multipartUnavailable = true;
      } else if (status != null && status >= 400 && status < 500) {
        // Hard-fail on 4xx other than 501 (bad request, auth error)
        throw err;
      }
      onProgress(0);
    }
  }

  // Small file, or multipart not configured: try direct presigned URL first
  try {
    return await attemptDirectUpload(basePath, file, authHeaders, onProgress);
  } catch (err) {
    const status = (err as Error & { status?: number }).status;

    // Both multipart and presign are unconfigured (501) AND the file is large —
    // the proxy will also fail for large files. Short-circuit immediately with an
    // actionable message instead of silently retrying a doomed proxy attempt.
    if (status === 501 && multipartUnavailable) {
      const sizeErr = new Error(
        "File too large — set R2_S3_ACCESS_KEY_ID and R2_S3_SECRET_ACCESS_KEY in Render to enable large video uploads."
      ) as Error & { status?: number };
      sizeErr.status = 501;
      throw sizeErr;
    }

    onProgress(0);
  }

  return attemptProxyUpload(basePath, file, authHeaders, onProgress);
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

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
    ): Promise<{ method: "PUT"; url: string; headers?: Record<string, string> }> => {
      const authHeaders = optionsRef.current.getAuthHeaders?.() ?? {};
      const res = await fetch(`${basePath}/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });
      if (!res.ok) throw new Error("Failed to get upload URL");
      const data = (await res.json()) as { uploadURL: string };
      return { method: "PUT", url: data.uploadURL, headers: { "Content-Type": file.type || "application/octet-stream" } };
    },
    [basePath],
  );

  return { uploadFile, getUploadParameters, isUploading, error, progress };
}
