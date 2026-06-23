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
 * Two-step upload:
 *   1. POST /api/storage/uploads/request-url → get a GCS presigned URL (tiny JSON, no size limit)
 *   2. XHR PUT directly to GCS using that URL (bypasses Replit proxy entirely)
 *
 * The GCS bucket is configured with Access-Control-Allow-Origin: * so direct
 * browser→GCS PUTs work without CORS errors.
 */
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

    try {
      // Step 1: request a presigned GCS URL from our server (JSON only, no file bytes)
      const urlResp = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });
      if (!urlResp.ok) {
        const body = await urlResp.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Failed to get upload URL (${urlResp.status})`);
      }
      const { uploadURL, objectPath, metadata } = await urlResp.json() as UploadResponse;
      setProgress(5);

      // Step 2: PUT the file bytes directly to GCS (no Replit proxy involved)
      // GCS bucket CORS is configured with Allow-Origin: * so this works from any origin.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadURL);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(5 + Math.round((e.loaded / e.total) * 92));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`GCS upload failed (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("Upload cancelled"));

        xhr.send(file);
      });

      setProgress(100);
      const result: UploadResponse = { uploadURL, objectPath, metadata };
      optionsRef.current.onSuccess?.(result);
      return result;
    } catch (err) {
      const uploadError = err instanceof Error ? err : new Error("Upload failed");
      setError(uploadError);
      optionsRef.current.onError?.(uploadError);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { uploadFile, isUploading, error, progress };
}
