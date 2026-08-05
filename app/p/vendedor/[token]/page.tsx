import type { Metadata } from "next";
import { Fragment } from "react";
import { dbGet } from "@/lib/storage-adapter";
import { listarOrcamentos } from "@/lib/storage";
import { totalOrcamento, fmtBRL } from "@/lib/email-orcamento";
import type { Orcamento, OrdemServico, Projeto, Tarefa } from "@/app/types";
import type { Vendedor } from "@/app/api/financeiro/vendas-comissoes/vendedores/route";
import SistemaLogo from "@/app/components/SistemaLogo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acompanhamento de Pedidos — Omni Alt",
};

interface RegistroPagamento {
  orcamentoId?: string;
  pago?: boolean;
}

function fmtData(d?: string): string {
  if (!d) return "—";
  // Já está em dd/mm/aaaa
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
  // YYYY-MM-DD → dd/mm/aaaa
  const [ano, mes, dia] = d.split("-");
  if (ano && mes && dia && ano.length === 4) return `${dia}/${mes}/${ano}`;
  return d;
}

type EstadoEtapa = "completa" | "atual" | "futura" | "falha";

/** Marcos do fluxo que o pedido percorre até "Concluído" */
const MARCO = ["Orçamento", "Enviado", "Aprovado", "Produção", "Pago", "Concluído"];

/** true quando o pedido já está em algum estágio de produção (orçamento, OS ou fornecedor) */
function emProducao(orc: Orcamento, os?: OrdemServico): boolean {
  if (orc.status === "Em produção") return true;
  if (os && ["Em produção", "Pronto", "Entregue"].includes(os.status)) return true;
  if (os?.statusFornecedor && ["Em produção", "Aguardando coleta", "Entregue"].includes(os.statusFornecedor)) return true;
  return false;
}

/** Roadmap do pedido: qual marco foi alcançado (ou onde falhou) */
function etapasMacro(orc: Orcamento, os: OrdemServico | undefined, pago: boolean | undefined): { label: string; estado: EstadoEtapa }[] {
  // Estados terminais: o pedido parou antes de concluir
  const falha =
    orc.status === "Cancelado" ? 0 :
    orc.status === "Recusado" ? 2 :
    os?.status === "Cancelada" ? 3 :
    null;

  if (falha !== null) {
    return MARCO.map((label, i) => ({
      label,
      estado: i < falha ? "completa" : i === falha ? "falha" : "futura",
    }));
  }

  const atual =
    orc.status === "Concluído" ? 5 :
    pago === true ? 4 :
    emProducao(orc, os) ? 3 :
    orc.status === "Aprovado" ? 2 :
    orc.status === "Enviado" ? 1 :
    0;

  return MARCO.map((label, i) => ({
    label,
    estado: i < atual ? "completa" : i === atual ? "atual" : "futura",
  }));
}

/** Bolinha de um marco do roadmap */
function Dot({ estado }: { estado: EstadoEtapa }) {
  const base = "w-3 h-3 rounded-full shrink-0";
  switch (estado) {
    case "completa": return <span className={`${base} bg-emerald-400`} />;
    case "atual": return <span className={`${base} bg-emerald-400 ring-4 ring-emerald-400/25`} />;
    case "falha":
      return (
        <span className={`${base} bg-red-500 flex items-center justify-center text-white text-[8px] leading-none`}>
          ✕
        </span>
      );
    default: return <span className={`${base} bg-white/10 border border-white/20`} />;
  }
}

/** Roadmap horizontal: bolinhas dos marcos conectadas por uma linha */
function RoadmapMacro({ etapas }: { etapas: { label: string; estado: EstadoEtapa }[] }) {
  return (
    <div className="flex items-start w-full pt-1">
      {etapas.map((e, i) => (
        <Fragment key={e.label}>
          {i > 0 && (
            <div
              className={`flex-1 h-0.5 mt-1.5 rounded ${
                etapas[i - 1].estado === "completa" || etapas[i - 1].estado === "atual"
                  ? "bg-emerald-400/60"
                  : "bg-white/10"
              }`}
            />
          )}
          <div className="flex flex-col items-center gap-1 w-12 shrink-0">
            <Dot estado={e.estado} />
            <span
              className={`text-[9px] leading-tight text-center ${
                e.estado === "atual" ? "text-white font-semibold" :
                e.estado === "falha" ? "text-red-400" :
                e.estado === "futura" ? "text-gray-600" :
                "text-gray-400"
              }`}
            >
              {e.label}
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const vendedores = await dbGet<Vendedor[]>("financeiro-vendedores", []);
  const vendedor = vendedores.find((v) => v.linkToken === token);

  if (!vendedor || vendedor.ativo !== true) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <SistemaLogo width={180} height={50} className="mx-auto object-contain" />
          </div>
          <div className="bg-gray-900 rounded-3xl border border-white/10 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v2m0 4h.01" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Link inválido ou revogado</h1>
            <p className="text-gray-400 text-sm">
              Este link de acompanhamento não está mais ativo. Peça para a equipe comercial gerar um novo link.
            </p>
          </div>
          <p className="text-center text-xs text-gray-600 mt-6">Omni Alt — acompanhamento de pedidos</p>
        </div>
      </main>
    );
  }

  const orcamentos = (await listarOrcamentos())
    .filter((o) => o.vendedorId === vendedor.id)
    .sort((a, b) => (b.dataOrcamento || "").localeCompare(a.dataOrcamento || ""));

  const ordens = await dbGet<OrdemServico[]>("ordens-servico", []);
  const faturamentos = await dbGet<{ registros: RegistroPagamento[] }>("faturamentos", { registros: [] });
  const projetos = await dbGet<Projeto[]>("planejamento", []);
  const tarefas = await dbGet<Tarefa[]>("planejamento-tarefas", []);

  const pedidos: {
    orc: Orcamento;
    os?: OrdemServico;
    pago?: boolean;
    planejamento?: { nome: string; cor: string };
  }[] = orcamentos.map((orc) => {
    const os = ordens.find((s) => s.orcamentoId === orc.id);
    const fat = faturamentos.registros.find((r) => r.orcamentoId === orc.id);

    // Coluna atual do kanban de planejamento da tarefa vinculada a este orçamento
    const tarefa = tarefas.find((t) => !t.parentTaskId && t.customFields?.orcamentoId === orc.id);
    let planejamento: { nome: string; cor: string } | undefined;
    if (tarefa) {
      const proj = projetos.find((p) => p.id === tarefa.projectId);
      const coluna = proj?.statuses.find((s) => s.id === tarefa.statusId);
      if (coluna) planejamento = { nome: coluna.nome, cor: coluna.cor };
    }

    return { orc, os, pago: fat?.pago, planejamento };
  });

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10">
      <div className="max-w-3xl w-full mx-auto">
        {/* Cabeçalho */}
        <div className="text-center mb-10">
          <SistemaLogo width={180} height={50} className="mx-auto object-contain" />
          <h1 className="text-2xl font-bold text-white mt-6">Acompanhamento de Pedidos</h1>
          <p className="text-gray-400 text-sm mt-1">
            Olá, <span className="text-white font-semibold">{vendedor.nome}</span> — confira o status dos seus pedidos abaixo.
          </p>
        </div>

        {pedidos.length === 0 ? (
          <div className="bg-gray-900 rounded-3xl border border-white/10 p-12 text-center">
            <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-300 font-medium">Nenhum pedido encontrado</p>
            <p className="text-gray-500 text-sm mt-1">Assim que novos pedidos forem aprovados, eles aparecerão aqui.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pedidos.map(({ orc, os, pago, planejamento }) => {
              const etapas = etapasMacro(orc, os, pago);

              return (
                <div key={orc.id} className="bg-gray-900 rounded-3xl border border-white/10 p-6">
                  {/* Cabeçalho do pedido */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <h2 className="text-white font-bold text-lg leading-tight">
                        Orçamento {orc.numero}
                        {orc.nomeProjeto ? <span className="text-gray-400 font-medium"> · {orc.nomeProjeto}</span> : null}
                      </h2>
                      <p className="text-gray-400 text-sm mt-1">
                        {orc.cliente} · Emitido em {fmtData(orc.dataOrcamento)}
                        {orc.prazoEntrega ? <span className="text-gray-500"> · Entrega: {orc.prazoEntrega}</span> : null}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Valor do pedido</p>
                      <p className="text-xl font-bold text-white">{fmtBRL(totalOrcamento(orc))}</p>
                    </div>
                  </div>

                  {/* Roadmap do pedido */}
                  <div className="mt-5 pt-5 border-t border-white/5">
                    <RoadmapMacro etapas={etapas} />

                    {/* Planejamento */}
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wide text-gray-500 shrink-0">Planejamento</span>
                      {planejamento ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: planejamento.cor }} />
                          {planejamento.nome}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-gray-600 mt-10">Omni Alt — acompanhamento de pedidos</p>
      </div>
    </main>
  );
}
