import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import type { Orcamento, OrdemServico } from "@/app/types";

export const dynamic = "force-dynamic";

// ── GET /api/migrar/os-numero ──
// Também aceita GET pra facilitar rodar pelo navegador

export async function GET() {
  return executarMigracao();
}

// ── POST /api/migrar/os-numero ──
// Migração única: atualiza o numero das OS existentes para o numero do orçamento

export async function POST() {
  return executarMigracao();
}

async function executarMigracao() {
  try {
    const orcamentos = await dbGet<Orcamento[]>("orcamentos", []);
    const ordens = await dbGet<OrdemServico[]>("ordens-servico", []);

    const orcNumMap = new Map(orcamentos.map((o) => [o.id, o.numero]));

    let mudancas = 0;
    for (const os of ordens) {
      const numOrc = orcNumMap.get(os.orcamentoId);
      if (numOrc && os.numero !== numOrc) {
        os.numero = numOrc;
        mudancas++;
      }
    }

    if (mudancas > 0) {
      await dbSet("ordens-servico", ordens);
    }

    return NextResponse.json({
      ok: true,
      mensagem: `${mudancas} OS atualizada(s) com o número do orçamento.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
