import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";

export const dynamic = "force-dynamic";

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

const COLUNAS_PADRAO = [
  { id: gerarId(), nome: "A RECEBER", cor: "#6b7280", ordem: 0 },
  { id: gerarId(), nome: "EM ANDAMENTO", cor: "#3b82f6", ordem: 1 },
  { id: gerarId(), nome: "PENDENTE", cor: "#f97316", ordem: 2 },
  { id: gerarId(), nome: "CONCLUÍDO", cor: "#22c55e", ordem: 3 },
];

// ── GET /api/financeiro/planejamento ──

export async function GET() {
  let colunas = await dbGet<any[]>("financeiro-planejamento-config", []);
  if (!colunas.length) {
    // Auto-cria colunas padrão
    colunas = COLUNAS_PADRAO;
    await dbSet("financeiro-planejamento-config", colunas);
  }
  return NextResponse.json(colunas);
}

// ── PUT /api/financeiro/planejamento ──

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { colunas } = body;

    if (!Array.isArray(colunas) || colunas.length === 0) {
      return NextResponse.json({ error: "É necessário informar ao menos uma coluna." }, { status: 400 });
    }

    // Garantir que todas tenham id e ordem
    const normalizadas = colunas.map((c, i) => ({
      id: c.id || gerarId(),
      nome: c.nome,
      cor: c.cor || "#6b7280",
      ordem: i,
    }));

    await dbSet("financeiro-planejamento-config", normalizadas);
    return NextResponse.json(normalizadas);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[FINANCEIRO PLANEJAMENTO PUT ERROR]", msg);
    return NextResponse.json({ error: `Erro ao salvar colunas: ${msg}` }, { status: 500 });
  }
}
