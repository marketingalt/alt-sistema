/**
 * Adaptador de storage — usa Vercel KV em produção e arquivos locais em desenvolvimento.
 *
 * Em produção (Vercel serverless), o filesystem é read-only, então precisamos
 * do KV (Redis) para leitura e escrita de dados.
 *
 * Para ativar o KV no Vercel:
 *   1. Vercel Dashboard → Storage → Criar KV Database
 *   2. As env vars (KV_URL, KV_REST_API_URL, etc.) são injetadas automaticamente
 *   3. Redeploy
 */

import type { Orcamento, Fornecedor, Cliente, Produto } from "@/app/types";

// ── Tipos dos dados persistidos ──

export interface ContasPagarDB {
  contas: any[];
}
export interface ReembolsosDB {
  reembolsos: any[];
}
export interface FaturamentosDB {
  registros: any[];
}
export interface FluxoCaixaDB {
  lancamentos: any[];
}
export type DbKey =
  | "orcamentos"
  | "clientes"
  | "fornecedores"
  | "produtos"
  | "contador"
  | "contas-a-pagar"
  | "reembolsos"
  | "faturamentos"
  | "fluxo-caixa"
  | "configuracoes"
  | "sync-log"
  | "documentos-rh";

// ── Detecta ambiente ──

function isVercel(): boolean {
  return process.env.VERCEL === "1";
}

function canUseKV(): boolean {
  return process.env.KV_URL !== undefined;
}

// ── KV backend ──

async function kvGet<T>(key: DbKey): Promise<T | null> {
  const { kv } = await import("@vercel/kv");
  return kv.get<T>(key);
}

async function kvSet<T>(key: DbKey, value: T): Promise<void> {
  const { kv } = await import("@vercel/kv");
  await kv.set(key, value);
}

// ── File backend ──

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
/** No Vercel, /tmp/ é writable (ao contrário de /var/task/ que é read-only) */
const TMP_DIR = "/tmp/data";

function filePath(key: DbKey): string {
  return path.join(DATA_DIR, `${key}.json`);
}

function tmpPath(key: DbKey): string {
  return path.join(TMP_DIR, `${key}.json`);
}

function fileGet<T>(key: DbKey, fallback: T): T {
  try {
    const fp = filePath(key);
    if (!fs.existsSync(fp)) return fallback;
    return JSON.parse(fs.readFileSync(fp, "utf-8"));
  } catch {
    return fallback;
  }
}

function fileSet<T>(key: DbKey, value: T): void {
  const fp = filePath(key);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(value, null, 2));
}

function tmpGet<T>(key: DbKey, fallback: T): T {
  try {
    const fp = tmpPath(key);
    if (!fs.existsSync(fp)) return fallback;
    return JSON.parse(fs.readFileSync(fp, "utf-8"));
  } catch {
    return fallback;
  }
}

function tmpSet<T>(key: DbKey, value: T): void {
  const fp = tmpPath(key);
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(value, null, 2));
}

// ── Cache em memória (último recurso) ──

const memoryCache = new Map<DbKey, unknown>();

// ── API pública ──

/**
 * Lê dados do storage.
 * Ordem de consulta no Vercel sem KV:
 *   cache memória → /tmp/ (writable) → data/ (deployado via git)
 */
export async function dbGet<T>(key: DbKey, fallback: T): Promise<T> {
  if (canUseKV()) {
    const val = await kvGet<T>(key);
    return val !== null ? val : fallback;
  }

  if (isVercel()) {
    // 1. Cache de memória (mais recente, dentro da mesma instância)
    if (memoryCache.has(key)) {
      return memoryCache.get(key) as T;
    }
    // 2. /tmp/ (persiste entre requisições na mesma instância)
    const fromTmp = tmpGet<T>(key, fallback as T);
    if (fromTmp !== fallback) return fromTmp;
  }

  // 3. Filesystem deployado via git (ou local)
  return fileGet(key, fallback);
}

/**
 * Escreve dados no storage.
 * - Vercel com KV: usa Redis (persistente)
 * - Vercel sem KV: /tmp/ + cache de memória (persiste por instância)
 * - Local: filesystem (persistente)
 */
export async function dbSet<T>(key: DbKey, value: T): Promise<void> {
  if (canUseKV()) {
    await kvSet(key, value);
  } else if (isVercel()) {
    // Sem KV no Vercel:
    // 1. /tmp/ é writável e persiste entre requisições na mesma instância
    // 2. Memória como fallback rápido para leituras seguintes
    tmpSet(key, value);
    memoryCache.set(key, value);
  } else {
    fileSet(key, value);
  }
}
