import {
  useUpload as useUploadBase,
  type UseUploadOptions,
  type UploadResponse,
} from "@workspace/object-storage-web";

export type { UploadResponse };

/**
 * Cotopia-specific wrapper around the shared direct-upload-with-fallback
 * hook: injects the app's JWT (stored as `cotopia_token` in localStorage)
 * as an Authorization header, since both /uploads/upload and
 * /uploads/request-url require auth.
 */
export function useUpload(options: Omit<UseUploadOptions, "getAuthHeaders" | "basePath"> = {}) {
  return useUploadBase({
    ...options,
    getAuthHeaders: (): Record<string, string> => {
      const token = localStorage.getItem("cotopia_token");
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  });
}
