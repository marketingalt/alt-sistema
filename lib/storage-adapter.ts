/**
 * Adaptador de storage — usa Upstash Redis em produção e arquivos locais em desenvolvimento.
 *
 * Em produção (Vercel serverless), o filesystem é read-only, então precisamos
 * de um banco externo (Redis) para leitura e escrita persistente.
 *
 * O projeto usa @vercel/kv (Upstash Redis) — plano gratuito, sem cartão de crédito:
 *   1. Criar conta grátis em https://upstash.com
 *   2. Criar um Redis database → copiar REST URL e Token
 *   3. Configurar no Vercel (ou .env.local para testes):
 *        KV_REST_API_URL=https://xxxx.upstash.io
 *        KV_REST_API_TOKEN=xxxx
 *   4. Redeploy
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
  | "documentos-rh"
  | "planejamento"
  | "planejamento-tarefas"
  | "ordens-servico"
  | "financeiro-planejamento-config"
  | "financeiro-planejamento-tarefas"
  | "financeiro-vendedores"
  | "financeiro-vendas"
  | "financeiro-comissoes-nf"
  | "financeiro-relatorio-presets"
  | "reembolsos-despesas"
  | "rh-feedbacks";

// ── Detecta ambiente ──

function isVercel(): boolean {
  return process.env.VERCEL === "1";
}

function canUseKV(): boolean {
  return (
    process.env.UPSTASH_REDIS_REST_URL !== undefined &&
    process.env.UPSTASH_REDIS_REST_TOKEN !== undefined
  ) || (
    process.env.KV_REST_API_URL !== undefined &&
    process.env.KV_REST_API_TOKEN !== undefined
  );
}

// ── KV backend (Upstash Redis via SDK) ──

// ── KV backend (Upstash Redis) ──

let kvClient: import("@upstash/redis").Redis | null = null;

async function getKvClient(): Promise<import("@upstash/redis").Redis | null> {
  if (kvClient) return kvClient;
  try {
    const { Redis } = await import("@upstash/redis");
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
    if (!url || !token) return null;
    kvClient = new Redis({ url, token });
    return kvClient;
  } catch (err) {
    console.error("[KV CLIENT ERROR]", err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function kvGet<T>(key: DbKey): Promise<T | null> {
  try {
    const client = await getKvClient();
    if (!client) return null;
    return client.get<T>(key);
  } catch (err) {
    console.error(`[KV GET ERROR] ${key}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function kvSet<T>(key: DbKey, value: T): Promise<void> {
  try {
    const client = await getKvClient();
    if (!client) return;
    await client.set(key, value);
  } catch (err) {
    console.error(`[KV SET ERROR] ${key}:`, err instanceof Error ? err.message : String(err));
  }
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
