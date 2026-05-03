import fs from "fs";
import path from "path";

const LOG_PATH = path.join(process.cwd(), "data", "sync-log.json");

interface SyncLog {
  ultimaSync: string | null;
}

export function lerUltimaSync(): SyncLog {
  try {
    if (!fs.existsSync(LOG_PATH)) return { ultimaSync: null };
    return JSON.parse(fs.readFileSync(LOG_PATH, "utf-8"));
  } catch {
    return { ultimaSync: null };
  }
}

export function salvarUltimaSync(): void {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify({ ultimaSync: new Date().toISOString() }, null, 2));
}
