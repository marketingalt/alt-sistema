import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { buscarOrcamento, salvarOrcamento, deletarOrcamento, listarOrcamentos, sincronizarTarefasOrcamento, gerarOSdeOrcamento, criarTarefaFinanceira, moverTarefaPlanejamentoParaConcluido } from "@/lib/storage";
import { limparAnexosVinculados } from "@/lib/supabaseStorage";
import type { HistoricoAlteracao } from "@/app/types";

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

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
    const { userId } = await auth();
    const user = await currentUser();
    const nomeUsuario = user?.fullName || user?.firstName || "Desconhecido";

    // Busca orçamento anterior para comparar
    const orcamentoAnterior = await buscarOrcamento(id);

    // Gera entradas de histórico baseadas nas alterações
    const novasEntradas: HistoricoAlteracao[] = [];

    if (orcamentoAnterior) {
      const camposTexto: { campo: string; label: string; valorAnterior: string; valorNovo: string }[] = [
        { campo: "status", label: "Status", valorAnterior: orcamentoAnterior.status || "", valorNovo: dados.status || "" },
        { campo: "cliente", label: "Cliente", valorAnterior: orcamentoAnterior.cliente || "", valorNovo: dados.cliente || "" },
        { campo: "nomeProjeto", label: "Projeto", valorAnterior: orcamentoAnterior.nomeProjeto || "", valorNovo: dados.nomeProjeto || "" },
        { campo: "solicitante", label: "Solicitante", valorAnterior: orcamentoAnterior.solicitante || "", valorNovo: dados.solicitante || "" },
        { campo: "responsavel", label: "Responsável", valorAnterior: orcamentoAnterior.responsavel || "", valorNovo: dados.responsavel || "" },
        { campo: "prazoPagamento", label: "Prazo de pagamento", valorAnterior: orcamentoAnterior.prazoPagamento || "", valorNovo: dados.prazoPagamento || "" },
        { campo: "prazoEntrega", label: "Prazo de entrega", valorAnterior: orcamentoAnterior.prazoEntrega || "", valorNovo: dados.prazoEntrega || "" },
      ];

      for (const c of camposTexto) {
        if (c.valorAnterior !== c.valorNovo) {
          novasEntradas.push({
            id: gerarId(),
            tipo: c.campo === "status" ? "status" : "edicao",
            descricao: c.campo === "status"
              ? `Status alterado de "${c.valorAnterior}" para "${c.valorNovo}"`
              : `${c.label} alterado de "${c.valorAnterior || "—"}" para "${c.valorNovo || "—"}"`,
            valorAnterior: c.valorAnterior || undefined,
            valorNovo: c.valorNovo || undefined,
            usuarioNome: nomeUsuario,
            usuarioId: userId || undefined,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Verifica se itens foram alterados (mudança no total)
      const totalAntes = orcamentoAnterior.itens.reduce((a: number, i: any) => a + (i.total || 0), 0);
      const totalDepois = (dados.itens || []).reduce((a: number, i: any) => a + (i.total || 0), 0);
      if (Math.abs(totalDepois - totalAntes) > 0.01 && (dados.itens || []).length > 0) {
        novasEntradas.push({
          id: gerarId(),
          tipo: "edicao",
          descricao: `Valor total alterado de R$ ${totalAntes.toFixed(2).replace(".", ",")} para R$ ${totalDepois.toFixed(2).replace(".", ",")}`,
          valorAnterior: totalAntes.toFixed(2),
          valorNovo: totalDepois.toFixed(2),
          usuarioNome: nomeUsuario,
          usuarioId: userId || undefined,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const historicoFinal = [...(orcamentoAnterior?.historico || []), ...novasEntradas];

    const salvo = await salvarOrcamento({
      ...dados,
      id,
      historico: historicoFinal,
      updatedAt: new Date().toISOString(),
      updatedById: userId || undefined,
      updatedBy: nomeUsuario,
    });

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
    const { userId } = await auth();
    const user = await currentUser();
    const nomeUsuario = user?.fullName || user?.firstName || "Desconhecido";

    // Gera entradas de histórico baseadas nas alterações
    const novasEntradas: HistoricoAlteracao[] = [];

    if (patch.status && patch.status !== orcamento.status) {
      novasEntradas.push({
        id: gerarId(),
        tipo: "status",
        descricao: `Status alterado de "${orcamento.status}" para "${patch.status}"`,
        valorAnterior: orcamento.status,
        valorNovo: patch.status,
        usuarioNome: nomeUsuario,
        usuarioId: userId || undefined,
        timestamp: new Date().toISOString(),
      });
    }

    const salvo = await salvarOrcamento({
      ...orcamento,
      ...patch,
      historico: [...(orcamento.historico || []), ...novasEntradas],
      updatedAt: new Date().toISOString(),
      updatedById: userId || undefined,
      updatedBy: nomeUsuario,
    });

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

    // Limpa anexos vinculados (Supabase): documentos do orçamento + comprovante de Contas a Receber (chave = orcamento_id).
    // Nunca deve bloquear a exclusão acima, que já aconteceu — rodam em paralelo (cada uma já trata sua
    // própria falha sem lançar) para que uma eventual indisponibilidade do Supabase não some os tempos
    // de espera de rede das duas tabelas na resposta.
    await Promise.allSettled([
      limparAnexosVinculados("orcamento_anexos", "orcamento-anexos", { orcamento_id: id }).catch((err) =>
        console.error(`[DELETE /api/orcamentos/${id}] falha ao limpar anexos (orcamento_anexos):`, err)
      ),
      limparAnexosVinculados("financeiro_comprovantes", "financeiro-comprovantes", {
        tipo_lancamento: "contas_a_receber",
        lancamento_id: id,
      }).catch((err) =>
        console.error(`[DELETE /api/orcamentos/${id}] falha ao limpar anexos (financeiro_comprovantes):`, err)
      ),
    ]);

    console.log(`[DELETE /api/orcamentos/${id}] deletado com sucesso`);

    return NextResponse.json({ ok: true }, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DELETE /api/orcamentos] Erro ao deletar orçamento:", msg);
    if (err instanceof Error) console.error(err.stack);
    return NextResponse.json({ error: `Erro ao deletar: ${msg}` }, { status: 500 });
  }
}
