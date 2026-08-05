"use client";

import { Fragment, useState } from "react";
import type { Orcamento, OrdemServico } from "@/app/types";
import { totalOrcamento, fmtBRL } from "@/lib/email-orcamento";
import SistemaLogo from "@/app/components/SistemaLogo";

export interface Pedido {
  orc: Orcamento;
  os?: OrdemServico;
  pago?: boolean;
  planejamento?: { nome: string; cor: string; dataVencimento?: string };
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

// ── Ordenação ─────────────────────────────────────────
// Ordem do fluxo dos pedidos ativos (o "Concluído" vai para a seção própria)
const ORDEM_STATUS = ["Em andamento", "Enviado", "Aprovado", "Em produção", "Recusado", "Cancelado"];

function idxStatus(s?: string): number {
  const i = ORDEM_STATUS.indexOf(s || "");
  return i === -1 ? ORDEM_STATUS.length : i;
}

/** Converte dataOrcamento (dd/mm/aaaa ou YYYY-MM-DD) em número comparável para ordenar */
function dataNum(d?: string): number {
  if (!d) return 0;
  let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  if (m) return parseInt(m[3], 10) * 10000 + parseInt(m[2], 10) * 100 + parseInt(m[1], 10);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) return parseInt(m[1], 10) * 10000 + parseInt(m[2], 10) * 100 + parseInt(m[3], 10);
  return 0;
}

export default function AcompanhamentoCliente({
  token,
  vendedorNome,
  pedidos,
}: {
  token: string;
  vendedorNome: string;
  pedidos: Pedido[];
}) {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false);

  function passaFiltros(p: Pedido): boolean {
    const o = p.orc;
    if (filtroStatus && o.status !== filtroStatus) return false;
    const q = busca.toLowerCase();
    if (!q) return true;
    return (
      o.numero?.toLowerCase().includes(q) ||
      o.nomeProjeto?.toLowerCase().includes(q) ||
      o.cliente?.toLowerCase().includes(q) ||
      o.solicitante?.toLowerCase().includes(q)
    );
  }

  // Ativos: ordenados por status do fluxo e, dentro de cada, data mais recente primeiro
  const ativos = pedidos
    .filter((p) => p.orc.status !== "Concluído" && passaFiltros(p))
    .sort((a, b) => idxStatus(a.orc.status) - idxStatus(b.orc.status) || dataNum(b.orc.dataOrcamento) - dataNum(a.orc.dataOrcamento));

  // Concluídos: seção própria, em ordem de data (mais recente primeiro)
  const concluidos = pedidos
    .filter((p) => p.orc.status === "Concluído" && passaFiltros(p))
    .sort((a, b) => dataNum(b.orc.dataOrcamento) - dataNum(a.orc.dataOrcamento));

  function renderCard(p: Pedido) {
    const { orc, os, pago, planejamento } = p;
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
              {planejamento?.dataVencimento ? <span className="text-gray-500"> · Entrega: {fmtData(planejamento.dataVencimento)}</span> : null}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-3">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Valor do pedido</p>
              <p className="text-xl font-bold text-white">{fmtBRL(totalOrcamento(orc))}</p>
            </div>
            <a
              href={`/p/vendedor/${token}/pdf/${orc.id}?tipo=valores&preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#fb4d06] text-white px-4 py-2 text-xs font-semibold hover:opacity-90 transition"
              title="Visualizar orçamento"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Visualizar
            </a>
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
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10">
      <div className="max-w-3xl w-full mx-auto">
        {/* Cabeçalho */}
        <div className="text-center mb-10">
          <SistemaLogo width={180} height={50} className="mx-auto object-contain" />
          <h1 className="text-2xl font-bold text-white mt-6">Acompanhamento de Pedidos</h1>
          <p className="text-gray-400 text-sm mt-1">
            Olá, <span className="text-white font-semibold">{vendedorNome}</span> — confira o status dos seus pedidos abaixo.
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
          <div className="flex flex-col gap-6">
            {/* Filtros */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por número, projeto, cliente ou solicitante..."
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="py-2.5 px-3 bg-gray-900 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/30 min-w-[140px]"
              >
                <option value="">Todos os status</option>
                {ORDEM_STATUS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Pedidos ativos */}
            {ativos.length === 0 ? (
              <div className="bg-gray-900 rounded-3xl border border-white/10 p-10 text-center">
                <p className="text-gray-400 text-sm">
                  {busca || filtroStatus ? "Nenhum pedido ativo encontrado para esses filtros." : "Nenhum pedido ativo."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {ativos.map(renderCard)}
              </div>
            )}

            {/* Concluídos — ocultos atrás do botão */}
            {concluidos.length > 0 && (
              <div>
                <button
                  onClick={() => setMostrarConcluidos((p) => !p)}
                  className="w-full flex items-center justify-between bg-gray-900 rounded-3xl border border-white/10 px-5 py-4 hover:bg-gray-800/60 transition"
                >
                  <span className="inline-flex items-center gap-2.5 text-sm font-semibold text-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    Concluídos
                    <span className="text-gray-400 font-medium">{concluidos.length}</span>
                  </span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${mostrarConcluidos ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {mostrarConcluidos && (
                  <div className="mt-4 flex flex-col gap-4">
                    {concluidos.map(renderCard)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-600 mt-10">Omni Alt — acompanhamento de pedidos</p>
      </div>
    </main>
  );
}
