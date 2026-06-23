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

function filePath(key: DbKey): string {
  return path.join(DATA_DIR, `${key}.json`);
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

// ── Cache em memória para Vercel sem KV ──

/**
 * Cache em memória para uso em Vercel sem KV.
 * Dados persistem apenas enquanto a instância serverless está quente;
 * em cold starts, os dados serão perdidos.
 */
const memoryCache = new Map<DbKey, unknown>();

function memorySet<T>(key: DbKey, value: T): void {
  memoryCache.set(key, value);
  console.warn(`[storage] Dados salvos apenas em cache de memória para "${key}". Configure Vercel KV para persistência.`);
}

function memoryGet<T>(key: DbKey, fallback: T): T {
  if (memoryCache.has(key)) return memoryCache.get(key) as T;
  return fallback;
}

// ── API pública ──

/**
 * Lê dados do storage.
 * - Vercel com KV: usa Redis
 * - Vercel sem KV: tenta filesystem, depois cache de memória
 * - Local: usa filesystem
 */
export async function dbGet<T>(key: DbKey, fallback: T): Promise<T> {
  if (canUseKV()) {
    const val = await kvGet<T>(key);
    return val !== null ? val : fallback;
  }
  // Em Vercel (sem KV), tenta filesystem primeiro (dados deployados via git)
  const fromFile = fileGet<T>(key, fallback as T);
  // Se o filesystem não tinha dados, verifica cache de memória
  if (fromFile === fallback && isVercel()) {
    return memoryGet(key, fallback);
  }
  return fromFile;
}

/**
 * Escreve dados no storage.
 * - Vercel com KV: usa Redis (OK)
 * - Vercel sem KV: usa cache de memória (dados não persistem após cold start)
 * - Local: usa filesystem (OK)
 */
export async function dbSet<T>(key: DbKey, value: T): Promise<void> {
  if (canUseKV()) {
    await kvSet(key, value);
  } else if (isVercel()) {
    // Sem KV no Vercel: salva em memória como fallback
    // Dados serão perdidos em cold start, mas a operação não quebra
    memorySet(key, value);
  } else {
    fileSet(key, value);
  }
}
