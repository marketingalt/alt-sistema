import { dbGet, dbSet } from "./storage-adapter";

interface SyncLog {
  ultimaSync: string | null;
}

export async function lerUltimaSync(): Promise<SyncLog> {
  try {
    return await dbGet<SyncLog>("sync-log", { ultimaSync: null });
  } catch {
    return { ultimaSync: null };
  }
}

export async function salvarUltimaSync(): Promise<void> {
  await dbSet("sync-log", { ultimaSync: new Date().toISOString() });
}
