import fs from "fs";
import path from "path";

function isProduction(): boolean {
  return (
    typeof process !== "undefined" &&
    (process.env.VERCEL === "1" || process.env.BLOB_READ_WRITE_TOKEN !== undefined)
  );
}

// ---- Local filesystem helpers ----
const DATA_DIR = path.join(process.cwd(), "data", "uploads");

function fileWrite(subdir: string, id: string, fileName: string, buffer: Buffer): string {
  const dir = path.join(DATA_DIR, subdir, id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), buffer);
  return fileName; // local: store just the filename
}

function fileRead(subdir: string, id: string, fileName: string): Buffer {
  return fs.readFileSync(path.join(DATA_DIR, subdir, id, fileName));
}

function fileDelete(subdir: string, id: string, fileName: string): void {
  const filePath = path.join(DATA_DIR, subdir, id, fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function fileExists(subdir: string, id: string, fileName: string): boolean {
  return fs.existsSync(path.join(DATA_DIR, subdir, id, fileName));
}

function localUrl(subdir: string, id: string, fileName: string): string {
  return `/uploads/${subdir}/${id}/${fileName}`;
}

// ---- Vercel Blob helpers ----
async function blobUpload(buffer: Buffer, subdir: string, id: string, fileName: string): Promise<string> {
  const { put } = await import("@vercel/blob");
  const blob = await put(`uploads/${subdir}/${id}/${fileName}`, buffer, {
    access: "public",
  });
  return blob.url; // production: store the full blob URL
}

async function blobRead(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  return response.arrayBuffer();
}

async function blobDelete(url: string): Promise<void> {
  const { del } = await import("@vercel/blob");
  try {
    await del(url);
  } catch {
    // File already deleted
  }
}

// ---- Public API ----

/**
 * Upload a file. In production (Vercel), uploads to Vercel Blob and returns the public URL.
 * In development, writes to the local filesystem and returns the filename only.
 * Store the returned value as the `caminho` field in document metadata.
 */
export async function uploadFile(
  subdir: string,
  id: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  if (isProduction()) {
    return blobUpload(buffer, subdir, id, fileName);
  }
  return fileWrite(subdir, id, fileName, buffer);
}

/**
 * Read a file. `pathOrUrl` is either a full blob URL (production) or a filename (local).
 * Returns the file contents as Uint8Array.
 */
export async function readFile(
  subdir: string,
  id: string,
  pathOrUrl: string
): Promise<ArrayBuffer> {
  if (isProduction() && pathOrUrl.startsWith("http")) {
    return blobRead(pathOrUrl);
  }
  // Local, or caminho is still a filename
  return fileReadBuffer(subdir, id, pathOrUrl);
}

// Internal: read as ArrayBuffer for Response/Blob compatibility
function fileReadBuffer(subdir: string, id: string, fileName: string): ArrayBuffer {
  return fs.readFileSync(path.join(DATA_DIR, subdir, id, fileName)).buffer.slice(0);
}

/**
 * Delete a file. `pathOrUrl` is either a full blob URL (production) or a filename (local).
 */
export async function deleteFile(
  subdir: string,
  id: string,
  pathOrUrl: string
): Promise<void> {
  if (isProduction() && pathOrUrl.startsWith("http")) {
    return blobDelete(pathOrUrl);
  }
  fileDelete(subdir, id, pathOrUrl);
}

/**
 * Check if a file exists.
 */
export async function fileExistsCheck(
  subdir: string,
  id: string,
  pathOrUrl: string
): Promise<boolean> {
  if (isProduction() && pathOrUrl.startsWith("http")) {
    try {
      const response = await fetch(pathOrUrl, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  }
  return fileExists(subdir, id, pathOrUrl);
}

/**
 * Get the public URL for a stored file.
 * In production, returns the stored blob URL directly.
 * In development, returns the local `/uploads/...` path.
 */
export function getPublicUrl(
  subdir: string,
  id: string,
  storedValue: string
): string {
  if (storedValue.startsWith("http")) return storedValue; // already a blob URL
  return localUrl(subdir, id, storedValue);
}
