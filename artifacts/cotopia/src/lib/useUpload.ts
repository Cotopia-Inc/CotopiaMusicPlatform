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
 * Upload a file through the server-side proxy at POST /api/storage/uploads/upload.
 * The server stores the bytes in GCS, avoiding browser→GCS CORS issues.
 * Uses XHR for real byte-level progress tracking.
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
      const result = await new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/storage/uploads/upload");
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
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
              const body = JSON.parse(xhr.responseText) as { error?: string };
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
