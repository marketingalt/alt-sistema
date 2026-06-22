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

function isProduction(): boolean {
  // Só usa KV se as env vars estiverem configuradas —
  // no Vercel sem KV criado, VERCEL=1 mas KV_URL não existe,
  // então usamos filesystem (pelo menos leituras funcionam)
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

// ── API pública ──

export async function dbGet<T>(key: DbKey, fallback: T): Promise<T> {
  if (isProduction()) {
    const val = await kvGet<T>(key);
    return val !== null ? val : fallback;
  }
  return fileGet(key, fallback);
}

export async function dbSet<T>(key: DbKey, value: T): Promise<void> {
  if (isProduction()) {
    await kvSet(key, value);
  } else {
    fileSet(key, value);
  }
}
