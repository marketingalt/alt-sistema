"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import AvatarIniciais from "@/app/components/AvatarIniciais";
import ParticipantesAvatar from "@/app/components/ParticipantesAvatar";
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

type RowData = Orcamento & { fat: RegistroFaturamento };

/* ───────── helpers ───────── */
const STATUS_FATURAMENTO: StatusOrcamento[] = ["Enviado", "Aprovado"];

const JOB_STATUS_CFG: Record<StatusOrcamento, { bg: string; text: string; dot: string }> = {
  "Em andamento": { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500" },
  "Enviado":      { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  "Aprovado":     { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
  "Recusado":     { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
  "Cancelado":    { bg: "bg-gray-100",  text: "text-gray-500",   dot: "bg-gray-400" },
};

const NOTA_STATUS_CFG = {
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

function custosCalculados(orc: Orcamento): number {
  return (orc.itens || []).reduce((s, i) => s + calcularCustoTotal(i) * (i.quantidade || 0), 0);
}

function novoRegistro(orcamentoId: string): RegistroFaturamento {
  return { orcamentoId, statusNota: "Pendente", pago: false };
}

/* ───────── célula editável ───────── */
function CelulaEditavel({
  valor, tipo = "text", opcoes, placeholder, onSalvar, className = "",
}: {
  valor: string; tipo?: "text" | "date" | "number" | "select";
  opcoes?: string[]; placeholder?: string; onSalvar: (v: string) => void; className?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState(valor);
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);

  useEffect(() => { if (editando) ref.current?.focus(); }, [editando]);
  useEffect(() => { setDraft(valor); }, [valor]);

  function confirmar() {
    setEditando(false);
    if (draft !== valor) onSalvar(draft);
  }

  if (!editando) {
    return (
      <div onClick={() => setEditando(true)}
        className={`cursor-pointer hover:bg-[#fb4d06]/5 rounded px-1.5 py-0.5 min-w-[60px] min-h-[22px] ${className}`}>
        {valor || <span className="text-gray-300 italic text-[10px]">{placeholder || "—"}</span>}
      </div>
    );
  }

  if (tipo === "select" && opcoes) {
    return (
      <select ref={ref} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={confirmar}
        className="border border-[#fb4d06]/40 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none w-full">
        {opcoes.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <input ref={ref} type={tipo} value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => { if (e.key === "Enter") confirmar(); if (e.key === "Escape") { setDraft(valor); setEditando(false); } }}
      className="border border-[#fb4d06]/40 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none w-full"
    />
  );
}

/* ───────── página ───────── */
export default function FaturamentosPage() {
  const { user } = useUser();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [registros, setRegistros] = useState<RegistroFaturamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<"todos" | StatusOrcamento>("todos");
  const [salvando, setSalvando] = useState<Set<string>>(new Set());
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/orcamentos").then((r) => r.json()),
      fetch("/api/faturamentos").then((r) => r.json()),
    ]).then(([orcs, fats]: [Orcamento[], { registros: RegistroFaturamento[] }]) => {
      setOrcamentos(orcs.filter((o) => STATUS_FATURAMENTO.includes(o.status)));
      setRegistros(fats.registros || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/usuarios").then((r) => r.json()).then(setUsuarios).catch(() => {});
  }, []);

  const rows: RowData[] = useMemo(() => {
    return orcamentos.map((o) => ({
      ...o,
      fat: registros.find((r) => r.orcamentoId === o.id) ?? novoRegistro(o.id),
    }));
  }, [orcamentos, registros]);

  const filtrados = useMemo(() => {
    let lista = rows;
    if (statusFiltro !== "todos") lista = lista.filter((r) => r.status === statusFiltro);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter((r) =>
        r.cliente.toLowerCase().includes(q) ||
        r.numero.toLowerCase().includes(q) ||
        (r.nomeProjeto || "").toLowerCase().includes(q)
      );
    }
    if (filtroUsuario === "meus") lista = lista.filter((r) => r.userId === user?.id);
    else if (filtroUsuario) lista = lista.filter((r) => r.userId === filtroUsuario);
    return lista;
  }, [rows, statusFiltro, busca, filtroUsuario, user?.id]);

  const kpis = useMemo(() => {
    const totalAprovado = rows.reduce((s, r) => s + valorAprovado(r), 0);
    const totalCustos   = rows.reduce((s, r) => {
      const imposto = r.fat.imposto ?? 0;
      const comissao = r.fat.comissao ?? 0;
      const custo = r.fat.custo ?? r.fat.custosReais ?? custosCalculados(r);
      return s + imposto + comissao + custo;
    }, 0);
    const totalPago     = rows.filter((r) => r.fat.pago).reduce((s, r) => s + valorAprovado(r), 0);
    const aPagar        = totalAprovado - totalPago;
    return { totalAprovado, totalCustos, totalPago, aPagar, rent: totalAprovado - totalCustos };
  }, [rows]);

  async function atualizarFat(orcamentoId: string, patch: Partial<RegistroFaturamento>) {
    setSalvando((s) => new Set(s).add(orcamentoId));
    try {
      await fetch(`/api/faturamentos/${orcamentoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setRegistros((prev) => {
        const idx = prev.findIndex((r) => r.orcamentoId === orcamentoId);
        if (idx >= 0) {
          const novo = [...prev];
          novo[idx] = { ...novo[idx], ...patch };
          return novo;
        }
        return [...prev, { ...novoRegistro(orcamentoId), ...patch }];
      });
    } finally {
      setSalvando((s) => { const n = new Set(s); n.delete(orcamentoId); return n; });
    }
  }

  async function mudarStatusJob(id: string, novoStatus: StatusOrcamento) {
    if (!confirm(`Alterar status do orçamento para "${novoStatus}"? ${["Recusado","Cancelado"].includes(novoStatus) ? "Ele sairá de Faturamentos." : ""}`)) return;
    await fetch(`/api/orcamentos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    });
    if (["Recusado", "Cancelado"].includes(novoStatus)) {
      setOrcamentos((prev) => prev.filter((o) => o.id !== id));
    } else {
      setOrcamentos((prev) => prev.map((o) => o.id === id ? { ...o, status: novoStatus } : o));
    }
  }

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
            <p className="text-gray-500 text-sm mt-0.5">Orçamentos enviados e aprovados — controle de nota, custos e recebimento.</p>
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
          <input placeholder="Buscar cliente, nº ou projeto..."
            value={busca} onChange={(e) => setBusca(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 w-52" />
          {(["todos", "Enviado", "Aprovado"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFiltro(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${statusFiltro === s ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              {s === "todos" ? "Todos" : s}
            </button>
          ))}
          {usuarios.length > 0 && (
            <select value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
              <option value="">👤 Todos</option>
              <option value="meus">🙋 Meus registros</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filtrados.length} job(s) · clique numa célula para editar</span>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="text-xs w-full min-w-[1400px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                {[
                  "CLIENTE", "JOB", "RESPONSÁVEL", "STATUS DO JOB",
                  "VALOR APROVADO", "IMPOSTO", "COMISSÃO", "CUSTO", "A PAGAR", "RENTABILIDADE",
                  "STATUS NOTA", "Nº NOTA", "EMISSÃO", "VENCIMENTO", "PAGO", "CRIADO POR",
                ].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-[10px] text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={16} className="text-center py-12 text-gray-400">Nenhum faturamento encontrado.</td></tr>
              )}
              {filtrados.map((row) => {
                const vAprov     = valorAprovado(row);
                const imposto   = row.fat.imposto ?? 0;
                const comissao  = row.fat.comissao ?? 0;
                const custo     = row.fat.custo ?? row.fat.custosReais ?? custosCalculados(row);
                const despesas  = imposto + comissao + custo;
                const aPagar    = row.fat.pago ? 0 : vAprov - despesas;
                const rent      = vAprov - despesas;
                const rentPct   = vAprov > 0 ? (rent / vAprov) * 100 : 0;
                const jobCfg   = JOB_STATUS_CFG[row.status];
                const notaCfg  = NOTA_STATUS_CFG[row.fat.statusNota];
                const isSaving = salvando.has(row.id);

                return (
                  <>
                  <tr key={row.id} className={`border-b border-gray-50 hover:bg-gray-50/40 ${isSaving ? "opacity-60" : ""}`}>
                    {/* CLIENTE */}
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-gray-800 whitespace-nowrap">{row.cliente || "—"}</p>
                      <p className="text-[10px] text-gray-400">{row.numero}</p>
                    </td>

                    {/* JOB */}
                    <td className="px-3 py-2.5 max-w-[160px]">
                      <Link href={`/orcamentos/${row.id}`} className="font-medium text-gray-700 hover:text-[#fb4d06] hover:underline truncate block">
                        {row.nomeProjeto || row.numero}
                      </Link>
                    </td>

                    {/* RESPONSÁVEL */}
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                      {row.solicitante || "—"}
                    </td>

                    {/* STATUS DO JOB */}
                    <td className="px-3 py-2.5">
                      <div className="relative group/status">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold cursor-pointer ${jobCfg.bg} ${jobCfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${jobCfg.dot}`} />
                          {row.status}
                        </span>
                        {/* Dropdown de status */}
                        <div className="absolute left-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-xl shadow-lg py-1 hidden group-hover/status:block min-w-[130px]">
                          {(["Enviado", "Aprovado", "Recusado", "Cancelado"] as StatusOrcamento[]).map((s) => (
                            <button key={s} onClick={() => mudarStatusJob(row.id, s)}
                              className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-50 ${s === row.status ? "text-[#fb4d06]" : "text-gray-700"}`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </td>

                    {/* VALOR APROVADO */}
                    <td className="px-3 py-2.5 text-right">
                      <p className="font-bold text-gray-800 whitespace-nowrap">{fmt(vAprov)}</p>
                    </td>

                    {/* IMPOSTO */}
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <CelulaEditavel
                          valor={imposto > 0 ? imposto.toFixed(2) : ""}
                          tipo="number"
                          placeholder="0,00"
                          className="text-right text-red-600 font-medium"
                          onSalvar={(v) => {
                            if (v.endsWith("%")) {
                              const pct = parseFloat(v) || 0;
                              atualizarFat(row.id, { imposto: vAprov * (pct / 100), percentualImposto: pct });
                            } else {
                              atualizarFat(row.id, { imposto: parseFloat(v) || 0 });
                            }
                          }}
                        />
                        {row.fat.percentualImposto != null && (
                          <span className="text-[10px] text-gray-400 font-medium">({row.fat.percentualImposto}%)</span>
                        )}
                      </div>
                    </td>
                    {/* COMISSÃO */}
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <CelulaEditavel
                          valor={comissao > 0 ? comissao.toFixed(2) : ""}
                          tipo="number"
                          placeholder="0,00"
                          className="text-right text-purple-700 font-medium"
                          onSalvar={(v) => {
                            if (v.endsWith("%")) {
                              const pct = parseFloat(v) || 0;
                              atualizarFat(row.id, { comissao: vAprov * (pct / 100), percentualComissao: pct });
                            } else {
                              atualizarFat(row.id, { comissao: parseFloat(v) || 0 });
                            }
                          }}
                        />
                        {row.fat.percentualComissao != null && (
                          <span className="text-[10px] text-gray-400 font-medium">({row.fat.percentualComissao}%)</span>
                        )}
                      </div>
                    </td>
                    {/* CUSTO */}
                    <td className="px-3 py-2.5 text-right">
                      <CelulaEditavel
                        valor={custo > 0 ? custo.toFixed(2) : ""}
                        tipo="number"
                        placeholder={fmt(custosCalculados(row))}
                        className="text-right text-orange-700 font-medium"
                        onSalvar={(v) => atualizarFat(row.id, { custo: parseFloat(v) || 0 })}
                      />
                    </td>

                    {/* A PAGAR */}
                    <td className="px-3 py-2.5 text-right">
                      <p className={`font-bold whitespace-nowrap ${aPagar > 0 ? "text-blue-700" : "text-gray-400"}`}>
                        {fmt(aPagar)}
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
                      <span className={`inline-block px-2 py-0.5 rounded-md font-semibold cursor-pointer ${notaCfg.bg} ${notaCfg.text}`}>
                        <CelulaEditavel
                          valor={row.fat.statusNota}
                          tipo="select"
                          opcoes={["Pendente", "Emitida", "Cancelada"]}
                          className={`font-semibold ${notaCfg.text}`}
                          onSalvar={(v) => atualizarFat(row.id, { statusNota: v as RegistroFaturamento["statusNota"] })}
                        />
                      </span>
                    </td>

                    {/* Nº NOTA */}
                    <td className="px-3 py-2.5">
                      <CelulaEditavel
                        valor={row.fat.numeroNota || ""}
                        placeholder="000"
                        className="text-gray-700 font-mono"
                        onSalvar={(v) => atualizarFat(row.id, { numeroNota: v })}
                      />
                    </td>

                    {/* EMISSÃO */}
                    <td className="px-3 py-2.5">
                      <CelulaEditavel
                        valor={row.fat.dataEmissao ? new Date(row.fat.dataEmissao + "T12:00:00").toLocaleDateString("pt-BR") : ""}
                        tipo="date"
                        placeholder="dd/mm/aa"
                        className="text-gray-600"
                        onSalvar={(v) => atualizarFat(row.id, { dataEmissao: v })}
                      />
                    </td>

                    {/* VENCIMENTO */}
                    <td className="px-3 py-2.5">
                      <CelulaEditavel
                        valor={row.fat.vencimento ? new Date(row.fat.vencimento + "T12:00:00").toLocaleDateString("pt-BR") : ""}
                        tipo="date"
                        placeholder="dd/mm/aa"
                        className={`font-medium ${row.fat.vencimento && !row.fat.pago && new Date(row.fat.vencimento + "T12:00:00") < new Date() ? "text-red-600" : "text-gray-600"}`}
                        onSalvar={(v) => atualizarFat(row.id, { vencimento: v })}
                      />
                    </td>

                    {/* PAGO */}
                    <td className="px-3 py-2.5">
                      {row.fat.pago ? (
                        <button onClick={() => atualizarFat(row.id, { pago: false, dataPagamento: undefined })}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-100 text-green-700 font-semibold hover:bg-green-200 transition whitespace-nowrap">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          {row.fat.dataPagamento
                            ? new Date(row.fat.dataPagamento + "T12:00:00").toLocaleDateString("pt-BR")
                            : "Pago"}
                        </button>
                      ) : (
                        <button onClick={() => atualizarFat(row.id, { pago: true, dataPagamento: new Date().toISOString().split("T")[0] })}
                          className="px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600 font-semibold transition whitespace-nowrap">
                          Marcar pago
                        </button>
                      )}
                    </td>
                  </tr>
                  {/* Creator + participantes footer */}
                  <tr key={`${row.id}-footer`} className="border-b border-gray-50 hover:bg-gray-50/40">
                    <td colSpan={16} className="px-3 py-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <AvatarIniciais nome={(row as any).userName || "?"} size="sm" />
                          <span>{(row as any).userName || "—"}</span>
                          {(row as any).userId === user?.id && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Eu</span>}
                        </div>
                        <ParticipantesAvatar participantes={(row as any).participantes || []} />
                      </div>
                    </td>
                  </tr>
                  </>
                );
              })}
            </tbody>
            {filtrados.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={4} className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Total</td>
                  <td className="px-3 py-2.5 text-right font-bold text-gray-800">{fmt(filtrados.reduce((s, r) => s + valorAprovado(r), 0))}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-red-600">{fmt(filtrados.reduce((s, r) => s + (r.fat.imposto ?? 0), 0))}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-purple-700">{fmt(filtrados.reduce((s, r) => s + (r.fat.comissao ?? 0), 0))}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-orange-700">{fmt(filtrados.reduce((s, r) => s + (r.fat.custo ?? r.fat.custosReais ?? custosCalculados(r)), 0))}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-blue-700">{fmt(filtrados.filter((r) => !r.fat.pago).reduce((s, r) => s + Math.max(0, valorAprovado(r) - (r.fat.imposto ?? 0) - (r.fat.comissao ?? 0) - (r.fat.custo ?? r.fat.custosReais ?? custosCalculados(r))), 0))}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-green-700">
                    {fmt(filtrados.reduce((s, r) => s + (valorAprovado(r) - (r.fat.imposto ?? 0) - (r.fat.comissao ?? 0) - (r.fat.custo ?? r.fat.custosReais ?? custosCalculados(r))), 0))}
                  </td>
                  <td colSpan={6} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </main>
    </WorkspaceLayout>
  );
}
