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

export async function POST() {
  return executarMigracao();
}

async function executarMigracao() {
  try {
    const orcamentos = await dbGet<Orcamento[]>("orcamentos", []);
    const ordens = await dbGet<OrdemServico[]>("ordens-servico", []);

    // Debug: mostra o que encontrou
    const debug: string[] = [];
    debug.push(`Orçamentos encontrados: ${orcamentos.length}`);
    debug.push(`OS encontradas: ${ordens.length}`);
    debug.push(`Orçamento 1670: ${JSON.stringify(orcamentos.find(o => o.numero === '1670')?.id)}`);
    debug.push(`OS 1001: ${JSON.stringify(ordens.find(o => o.numero === '1001'), null, 2)}`);

    const orcNumMap = new Map(orcamentos.map((o) => [o.id, o.numero]));

    let mudancas = 0;
    for (const os of ordens) {
      const numOrc = orcNumMap.get(os.orcamentoId);
      if (numOrc && os.numero !== numOrc) {
        debug.push(`OS ${os.numero} → ${numOrc} (orcamentoId=${os.orcamentoId})`);
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
      debug,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, debug: [] }, { status: 500 });
  }
}
