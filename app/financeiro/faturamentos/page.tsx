"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import type { Orcamento, StatusOrcamento } from "@/app/types";
import { calcularCustoTotal } from "@/lib/calculos";

/* ───────── tipos ───────── */
interface RegistroFaturamento {
  orcamentoId: string;
  custosReais?: number;
  custo?: number;
  imposto?: number;
  percentualImposto?: number;
  comissao?: number;
  percentualComissao?: number;
  statusNota: "Pendente" | "Emitida" | "Cancelada";
  numeroNota?: string;
  dataEmissao?: string;
  vencimento?: string;
  pago: boolean;
  dataPagamento?: string;
  updatedAt?: string;
}

interface OrdemServico {
  id: string;
  orcamentoId?: string;
  numero: string;
}

interface ContaPagar {
  id: string;
  ordemServicoId?: string;
  valor: number;
}

type RowData = Orcamento & { fat: RegistroFaturamento; custosReais: number };

/* ───────── helpers ───────── */
const STATUS_FATURAMENTO: StatusOrcamento[] = ["Aprovado", "Em produção"];

const JOB_STATUS_CFG: Record<StatusOrcamento, { bg: string; text: string; dot: string }> = {
  "Em andamento": { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500" },
  "Enviado":      { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  "Aprovado":     { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
  "Em produção":  { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  "Concluído":    { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  "Recusado":     { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
  "Cancelado":    { bg: "bg-gray-100",  text: "text-gray-500",   dot: "bg-gray-400" },
};

const NOTA_STATUS_CFG: Record<string, { bg: string; text: string }> = {
  Pendente:  { bg: "bg-yellow-50", text: "text-yellow-700" },
  Emitida:   { bg: "bg-green-50",  text: "text-green-700" },
  Cancelada: { bg: "bg-gray-100",  text: "text-gray-500" },
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v: number) {
  return v.toFixed(1).replace(".", ",") + "%";
}

function valorAprovado(orc: Orcamento): number {
  const sub = (orc.itens || []).reduce((s, i) => s + (i.total || 0), 0);
  const frete = orc.freteValor || 0;
  const manuseio = orc.manuseio && orc.custoManuseio ? orc.custoManuseio : 0;
  return sub + frete + manuseio;
}

function formatDate(d?: string): string {
  if (!d) return "—";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

/* ───────── página ───────── */
export default function FaturamentosPage() {
  const { user } = useUser();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [registros, setRegistros] = useState<RegistroFaturamento[]>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<"todos" | StatusOrcamento>("todos");
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");

  const isAdmin =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress === "thiemy@altmkt.com.br" ||
    user?.publicMetadata?.role === "admin";

  useEffect(() => {
    Promise.all([
      fetch("/api/orcamentos").then((r) => r.json()),
      fetch("/api/faturamentos").then((r) => r.json()),
      fetch("/api/ordens-servico").then((r) => r.json()),
      fetch("/api/contas-a-pagar").then((r) => r.json()),
    ]).then(([orcs, fats, oss, caps]: any[]) => {
      setOrcamentos(orcs.filter((o: Orcamento) => STATUS_FATURAMENTO.includes(o.status)));
      setRegistros(fats.registros || []);
      setOrdensServico(Array.isArray(oss) ? oss : []);
      setContasPagar(caps.contas || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/usuarios").then((r) => r.json()).then(setUsuarios).catch(() => {});
  }, []);

  // Mapas para cálculo de custos reais
  const { osPorOrcamento, custoPorOS } = useMemo(() => {
    const osPorOrc = new Map<string, string[]>();
    const custoPorOs = new Map<string, number>();

    for (const os of ordensServico) {
      if (os.orcamentoId) {
        const arr = osPorOrc.get(os.orcamentoId) || [];
        arr.push(os.id);
        osPorOrc.set(os.orcamentoId, arr);
      }
    }

    for (const conta of contasPagar) {
      if (conta.ordemServicoId) {
        const atual = custoPorOs.get(conta.ordemServicoId) || 0;
        custoPorOs.set(conta.ordemServicoId, atual + Math.abs(conta.valor));
      }
    }

    return { osPorOrcamento: osPorOrc, custoPorOS: custoPorOs };
  }, [ordensServico, contasPagar]);

  function calcularCustosReais(orcamentoId: string): number {
    const osIds = osPorOrcamento.get(orcamentoId) || [];
    return osIds.reduce((sum, osId) => sum + (custoPorOS.get(osId) || 0), 0);
  }

  const rows: RowData[] = useMemo(() => {
    return orcamentos.map((o) => ({
      ...o,
      fat: registros.find((r) => r.orcamentoId === o.id) ?? { orcamentoId: o.id, statusNota: "Pendente" as const, pago: false },
      custosReais: calcularCustosReais(o.id),
    }));
  }, [orcamentos, registros, osPorOrcamento, custoPorOS]);

  const filtrados = useMemo(() => {
    let lista = rows;
    if (statusFiltro !== "todos") lista = lista.filter((r) => r.status === statusFiltro);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter((r) =>
        r.cliente.toLowerCase().includes(q) ||
        r.numero.toLowerCase().includes(q) ||
        (r.nomeProjeto || "").toLowerCase().includes(q) ||
        (r.solicitante || "").toLowerCase().includes(q)
      );
    }
    if (!isAdmin) {
      // Não-admin vê apenas orçamentos onde é userId, responsavel ou está em participantes
      lista = lista.filter((r) =>
        r.userId === user?.id ||
        r.responsavel === user?.fullName ||
        (r.participantes || []).some((p) => p.userId === user?.id)
      );
    } else if (filtroUsuario === "meus") {
      lista = lista.filter((r) => r.userId === user?.id);
    } else if (filtroUsuario) {
      lista = lista.filter((r) => r.userId === filtroUsuario);
    }
    return lista;
  }, [rows, statusFiltro, busca, filtroUsuario, user?.id, user?.fullName, isAdmin]);

  const kpis = useMemo(() => {
    const totalAprovado = rows.reduce((s, r) => s + valorAprovado(r), 0);
    const totalCustos   = rows.reduce((s, r) => {
      const imposto = r.fat.imposto ?? 0;
      const comissao = r.fat.comissao ?? 0;
      return s + imposto + comissao + r.custosReais;
    }, 0);
    const totalPago     = rows.filter((r) => r.fat.pago).reduce((s, r) => s + valorAprovado(r), 0);
    const aPagar        = totalAprovado - totalPago;
    return { totalAprovado, totalCustos, totalPago, aPagar, rent: totalAprovado - totalCustos };
  }, [rows]);

  const userDisplayName = user?.fullName || user?.firstName || "";

  if (loading) return (
    <WorkspaceLayout>
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-[#fb4d06] border-t-transparent rounded-full animate-spin" />
      </div>
    </WorkspaceLayout>
  );

  return (
    <WorkspaceLayout>
      <main className="px-6 py-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Faturamentos</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Orçamentos aprovados e em produção — visão consolidada de custos, notas e recebimento.
            </p>
          </div>
          <Link href="/orcamentos" className="bg-[#fb4d06] text-white font-semibold py-2 px-4 rounded-xl hover:opacity-90 transition flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Orçamentos
          </Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
            <p className="text-[10px] font-semibold text-green-700 uppercase mb-1">Valor Aprovado</p>
            <p className="text-lg font-bold text-green-800">{fmt(kpis.totalAprovado)}</p>
          </div>
          <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
            <p className="text-[10px] font-semibold text-orange-700 uppercase mb-1">Custos Reais</p>
            <p className="text-lg font-bold text-orange-800">{fmt(kpis.totalCustos)}</p>
          </div>
          <div className="bg-[#fb4d06]/5 rounded-2xl p-4 border border-[#fb4d06]/20">
            <p className="text-[10px] font-semibold text-[#fb4d06] uppercase mb-1">Rentabilidade</p>
            <p className="text-lg font-bold text-[#fb4d06]">{fmt(kpis.rent)}</p>
            <p className="text-[10px] text-orange-500 mt-0.5">
              {kpis.totalAprovado > 0 ? fmtPct((kpis.rent / kpis.totalAprovado) * 100) : "—"}
            </p>
          </div>
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
            <p className="text-[10px] font-semibold text-blue-700 uppercase mb-1">A Receber</p>
            <p className="text-lg font-bold text-blue-800">{fmt(kpis.aPagar)}</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <p className="text-[10px] font-semibold text-gray-600 uppercase mb-1">Recebido</p>
            <p className="text-lg font-bold text-gray-800">{fmt(kpis.totalPago)}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <input placeholder="Buscar cliente, nº, projeto ou solicitante..."
            value={busca} onChange={(e) => setBusca(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 w-60" />
          {(["todos", "Aprovado", "Em produção"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFiltro(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${statusFiltro === s ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              {s === "todos" ? "Todos" : s}
            </button>
          ))}
          {isAdmin && usuarios.length > 0 && (
            <select value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
              <option value="">👤 Todos</option>
              <option value="meus">🙋 Meus registros</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filtrados.length} job(s)</span>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="text-xs w-full min-w-[1400px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                {[
                  "CLIENTE", "NOME DO PROJETO", "SOLICITANTE", "STATUS DO JOB",
                  "VALOR APROVADO", "CUSTOS REAIS", "RENTABILIDADE",
                  "STATUS NOTA", "Nº NOTA", "EMISSÃO", "VENCIMENTO", "PAGTO",
                ].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-[10px] text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={12} className="text-center py-12 text-gray-400">Nenhum faturamento encontrado.</td></tr>
              )}
              {filtrados.map((row) => {
                const vAprov   = valorAprovado(row);
                const imposto  = row.fat.imposto ?? 0;
                const comissao = row.fat.comissao ?? 0;
                const custos   = row.custosReais;
                const despesas = imposto + comissao + custos;
                const rent     = vAprov - despesas;
                const rentPct  = vAprov > 0 ? (rent / vAprov) * 100 : 0;
                const jobCfg   = JOB_STATUS_CFG[row.status];
                const notaCfg  = NOTA_STATUS_CFG[row.fat.statusNota] || NOTA_STATUS_CFG.Pendente;
                const vencido  = row.fat.vencimento && !row.fat.pago && new Date(row.fat.vencimento + "T12:00:00") < new Date();

                return (
                  <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/40">
                    {/* CLIENTE */}
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-gray-800 whitespace-nowrap">{row.cliente || "—"}</p>
                      <p className="text-[10px] text-gray-400">{row.numero}</p>
                    </td>

                    {/* NOME DO PROJETO */}
                    <td className="px-3 py-2.5 max-w-[160px]">
                      <Link href={`/orcamentos/${row.id}`} className="font-medium text-gray-700 hover:text-[#fb4d06] hover:underline truncate block">
                        {row.nomeProjeto || row.numero}
                      </Link>
                    </td>

                    {/* SOLICITANTE */}
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                      {row.solicitante || "—"}
                    </td>

                    {/* STATUS DO JOB */}
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold ${jobCfg.bg} ${jobCfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${jobCfg.dot}`} />
                        {row.status}
                      </span>
                    </td>

                    {/* VALOR APROVADO */}
                    <td className="px-3 py-2.5 text-right">
                      <p className="font-bold text-gray-800 whitespace-nowrap">{fmt(vAprov)}</p>
                    </td>

                    {/* CUSTOS REAIS */}
                    <td className="px-3 py-2.5 text-right">
                      <p className={`font-bold whitespace-nowrap ${custos > 0 ? "text-orange-700" : "text-gray-400"}`}>
                        {custos > 0 ? fmt(custos) : "—"}
                      </p>
                    </td>

                    {/* RENTABILIDADE */}
                    <td className="px-3 py-2.5 text-right">
                      <p className={`font-bold whitespace-nowrap ${rent >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {fmt(rent)}
                      </p>
                      <p className={`text-[10px] ${rent >= 0 ? "text-green-500" : "text-red-400"}`}>
                        {fmtPct(rentPct)}
                      </p>
                    </td>

                    {/* STATUS NOTA */}
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-md font-semibold ${notaCfg.bg} ${notaCfg.text}`}>
                        {row.fat.statusNota}
                      </span>
                    </td>

                    {/* Nº NOTA */}
                    <td className="px-3 py-2.5 text-gray-700 font-mono">
                      {row.fat.numeroNota || "—"}
                    </td>

                    {/* EMISSÃO */}
                    <td className="px-3 py-2.5 text-gray-600">
                      {formatDate(row.fat.dataEmissao)}
                    </td>

                    {/* VENCIMENTO */}
                    <td className="px-3 py-2.5">
                      <span className={`font-medium ${vencido ? "text-red-600" : "text-gray-600"}`}>
                        {formatDate(row.fat.vencimento)}
                      </span>
                    </td>

                    {/* PAGTO */}
                    <td className="px-3 py-2.5">
                      {row.fat.pago ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 text-green-700 font-semibold whitespace-nowrap">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          {row.fat.dataPagamento
                            ? new Date(row.fat.dataPagamento + "T12:00:00").toLocaleDateString("pt-BR")
                            : "Pago"}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[10px] font-medium">Pendente</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filtrados.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={4} className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Total</td>
                  <td className="px-3 py-2.5 text-right font-bold text-gray-800">{fmt(filtrados.reduce((s, r) => s + valorAprovado(r), 0))}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-orange-700">{fmt(filtrados.reduce((s, r) => s + r.custosReais, 0))}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-green-700">
                    {fmt(filtrados.reduce((s, r) => s + (valorAprovado(r) - (r.fat.imposto ?? 0) - (r.fat.comissao ?? 0) - r.custosReais), 0))}
                  </td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </main>
    </WorkspaceLayout>
  );
}
