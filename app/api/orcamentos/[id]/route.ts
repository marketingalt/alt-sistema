import { NextRequest, NextResponse } from "next/server";
import { buscarOrcamento, salvarOrcamento, deletarOrcamento, listarOrcamentos, sincronizarTarefasOrcamento, gerarOSdeOrcamento, criarTarefaFinanceira, moverTarefaPlanejamentoParaConcluido } from "@/lib/storage";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orcamento = await buscarOrcamento(id);
  if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(orcamento, { headers: NO_CACHE_HEADERS });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const dados = await req.json();
    const salvo = await salvarOrcamento({ ...dados, id });

    // Sincronizar tarefas no Planejamento
    sincronizarTarefasOrcamento(salvo).catch((err) =>
      console.error("[ORCAMENTO SYNC ERROR]", err)
    );

    // Gerar OS automaticamente se o orçamento foi aprovado
    gerarOSdeOrcamento(salvo).catch((err) =>
      console.error("[ORCAMENTO OS ERROR]", err)
    );

    // Criar tarefa no Financeiro Kanban se aprovado
    criarTarefaFinanceira(salvo).catch((err) =>
      console.error("[FINANCEIRO TASK ERROR]", err)
    );

    // Mover card do Planejamento para Concluído se aprovado
    moverTarefaPlanejamentoParaConcluido(salvo).catch((err) =>
      console.error("[PLANEJAMENTO CONCLUIR ERROR]", err)
    );

    return NextResponse.json(salvo, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[PUT ORCAMENTO ERROR]", msg);
    return NextResponse.json({ error: `Erro ao salvar: ${msg}` }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orcamento = await buscarOrcamento(id);
    if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    const patch = await req.json();
    const salvo = await salvarOrcamento({ ...orcamento, ...patch });

    // Sincronizar tarefas no Planejamento
    sincronizarTarefasOrcamento(salvo).catch((err) =>
      console.error("[ORCAMENTO SYNC ERROR]", err)
    );

    // Gerar OS automaticamente se o orçamento foi aprovado
    gerarOSdeOrcamento(salvo).catch((err) =>
      console.error("[ORCAMENTO OS ERROR]", err)
    );

    // Criar tarefa no Financeiro Kanban se aprovado
    criarTarefaFinanceira(salvo).catch((err) =>
      console.error("[FINANCEIRO TASK ERROR]", err)
    );

    // Mover card do Planejamento para Concluído se aprovado
    moverTarefaPlanejamentoParaConcluido(salvo).catch((err) =>
      console.error("[PLANEJAMENTO CONCLUIR ERROR]", err)
    );

    return NextResponse.json(salvo, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[PATCH ORCAMENTO ERROR]", msg);
    return NextResponse.json({ error: `Erro ao alterar: ${msg}` }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    console.log(`[DELETE /api/orcamentos/${id}] iniciando`);

    const orcamento = await buscarOrcamento(id);
    if (!orcamento) {
      console.log(`[DELETE /api/orcamentos/${id}] orçamento não encontrado`);
      return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
    }

    await deletarOrcamento(id);
    console.log(`[DELETE /api/orcamentos/${id}] deletado com sucesso`);

    return NextResponse.json({ ok: true }, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DELETE /api/orcamentos] Erro ao deletar orçamento:", msg);
    if (err instanceof Error) console.error(err.stack);
    return NextResponse.json({ error: `Erro ao deletar: ${msg}` }, { status: 500 });
  }
}
