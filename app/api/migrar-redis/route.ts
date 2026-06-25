import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import type { DbKey } from "@/lib/storage-adapter";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data");

const CHAVES: DbKey[] = [
  "orcamentos",
  "clientes",
  "fornecedores",
  "produtos",
  "contas-a-pagar",
  "faturamentos",
  "fluxo-caixa",
  "configuracoes",
  "sync-log",
  "contador",
  "documentos-rh",
  "reembolsos",
];

export async function POST() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return NextResponse.json({ error: "Redis não configurado. Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN." }, { status: 400 });
  }

  const redis = new Redis({ url, token });
  const resultados: Record<string, string> = {};
  let totalItens = 0;

  for (const chave of CHAVES) {
    const fp = path.join(DATA_DIR, `${chave}.json`);
    if (!fs.existsSync(fp)) {
      resultados[chave] = "⚠️ arquivo não encontrado";
      continue;
    }

    try {
      const conteudo = fs.readFileSync(fp, "utf-8");
      const dados = JSON.parse(conteudo);
      await redis.set(chave, dados);

      const qtd = Array.isArray(dados) ? dados.length : 1;
      totalItens += qtd;
      resultados[chave] = `✅ ${qtd} registro(s) migrado(s) (${(Buffer.byteLength(conteudo) / 1024).toFixed(1)} KB)`;
    } catch (err) {
      resultados[chave] = `❌ ERRO: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return NextResponse.json({
    ok: true,
    totalItens,
    resultados,
    timestamp: new Date().toISOString(),
  });
}
