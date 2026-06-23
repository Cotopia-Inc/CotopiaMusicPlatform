import { useState, useCallback, useRef } from "react";
import type { UppyFile } from "@uppy/core";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: UploadMetadata;
}

interface UseUploadOptions {
  /** Base path where object storage routes are mounted (default: "/api/storage") */
  basePath?: string;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * React hook for handling file uploads.
 *
 * Posts the file directly to the server-side proxy endpoint, which stores it
 * in GCS internally. This avoids browser CORS restrictions that prevent direct
 * cross-origin PUTs to GCS signed URLs.
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

      try {
        const result = await new Promise<UploadResponse>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${basePath}/uploads/upload`);
          xhr.setRequestHeader(
            "Content-Type",
            file.type || "application/octet-stream"
          );
          xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.min(95, Math.round((e.loaded / e.total) * 95)));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText) as UploadResponse);
              } catch {
                reject(new Error("Invalid server response"));
              }
            } else {
              try {
                const body = JSON.parse(xhr.responseText) as {
                  error?: string;
                };
                reject(new Error(body.error ?? `Upload failed (${xhr.status})`));
              } catch {
                reject(new Error(`Upload failed (${xhr.status})`));
              }
            }
          };

          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.onabort = () => reject(new Error("Upload cancelled"));

          xhr.send(file);
        });

        setProgress(100);
        optionsRef.current.onSuccess?.(result);
        return result;
      } catch (err) {
        const uploadError =
          err instanceof Error ? err : new Error("Upload failed");
        setError(uploadError);
        optionsRef.current.onError?.(uploadError);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [basePath]
  );

  const getUploadParameters = useCallback(
    async (
      file: UppyFile<Record<string, unknown>, Record<string, unknown>>
    ): Promise<{
      method: "PUT";
      url: string;
      headers?: Record<string, string>;
    }> => {
      const response = await fetch(`${basePath}/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
