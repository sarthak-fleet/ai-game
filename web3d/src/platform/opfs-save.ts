/**
 * opfs-save.ts — local session persistence via the Origin Private File System.
 *
 * Frontier capability (web-frontier-prd §Phase 0): a save that lives entirely in
 * the browser's OPFS, no server. Stores a small JSON snapshot; durable storage
 * is requested so it survives eviction. Cleared by "clear site data".
 */

const DIR = "aliveville";
const FILE = "session.json";

export interface SessionSnapshot {
  worldId: string;
  savedAt: string;
  playerName: string;
  locationId: string;
  level: number;
}

export function opfsSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.storage) &&
    typeof navigator.storage.getDirectory === "function"
  );
}

async function sessionFile(create: boolean): Promise<FileSystemFileHandle> {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle(DIR, { create });
  return dir.getFileHandle(FILE, { create });
}

export async function saveSession(snapshot: SessionSnapshot): Promise<void> {
  if (navigator.storage.persist) await navigator.storage.persist();
  const handle = await sessionFile(true);
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(snapshot));
  await writable.close();
}

export async function loadSession(): Promise<SessionSnapshot | null> {
  try {
    const handle = await sessionFile(false);
    const file = await handle.getFile();
    return JSON.parse(await file.text()) as SessionSnapshot;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(DIR, { create: false });
    await dir.removeEntry(FILE);
  } catch {
    // nothing to clear
  }
}
