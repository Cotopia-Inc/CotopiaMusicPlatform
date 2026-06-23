import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

/**
 * Local-disk file storage — works on Render (persistent disk) and in dev (tmp dir).
 *
 * Configure via env:
 *   STORAGE_DIR   — absolute path to the writable directory (e.g. Render disk mount).
 *                   Falls back to <os.tmpdir()>/cotopia-uploads in dev.
 */

function getStorageDir(): string {
  return process.env.STORAGE_DIR ?? path.join(os.tmpdir(), "cotopia-uploads");
}

export interface StoredFile {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  storedAt: string;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Save a Buffer to disk under <STORAGE_DIR>/uploads/<uuid>.
 * Returns a stable object path of the form /objects/uploads/<uuid>.
 */
export async function saveFile(
  buffer: Buffer,
  originalName: string,
  contentType: string,
): Promise<{ objectPath: string; size: number }> {
  const storageDir = getStorageDir();
  const uploadsDir = path.join(storageDir, "uploads");
  await ensureDir(uploadsDir);

  const id = randomUUID();
  const filePath = path.join(uploadsDir, id);

  const metaPath = `${filePath}.meta.json`;
  const meta: StoredFile = {
    id,
    filename: originalName,
    contentType,
    size: buffer.length,
    storedAt: new Date().toISOString(),
  };

  await Promise.all([
    fs.writeFile(filePath, buffer),
    fs.writeFile(metaPath, JSON.stringify(meta)),
  ]);

  return { objectPath: `/objects/uploads/${id}`, size: buffer.length };
}

/**
 * Read a stored file from disk given its objectPath (/objects/uploads/<id>).
 * Returns the buffer and its metadata.
 */
export async function readFile(objectPath: string): Promise<{
  buffer: Buffer;
  meta: StoredFile;
}> {
  if (!objectPath.startsWith("/objects/uploads/")) {
    throw new FileNotFoundError(objectPath);
  }
  const id = objectPath.slice("/objects/uploads/".length);
  if (!id || id.includes("/") || id.includes("..")) {
    throw new FileNotFoundError(objectPath);
  }

  const storageDir = getStorageDir();
  const filePath = path.join(storageDir, "uploads", id);
  const metaPath = `${filePath}.meta.json`;

  try {
    const [buffer, metaRaw] = await Promise.all([
      fs.readFile(filePath),
      fs.readFile(metaPath, "utf8"),
    ]);
    return { buffer, meta: JSON.parse(metaRaw) as StoredFile };
  } catch {
    throw new FileNotFoundError(objectPath);
  }
}

export class FileNotFoundError extends Error {
  constructor(objectPath: string) {
    super(`File not found: ${objectPath}`);
    this.name = "FileNotFoundError";
    Object.setPrototypeOf(this, FileNotFoundError.prototype);
  }
}
