"use client";

import { useEffect, useState, useMemo } from "react";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import { downloadCSV } from "@/lib/export-csv";
import type { Vendedor } from "@/app/api/financeiro/vendas-comissoes/vendedores/route";
import type { Venda } from "@/app/api/financeiro/vendas-comissoes/vendas/route";
import type { RelatorioPreset, FiltrosRelatorio } from "@/app/api/financeiro/vendas-comissoes/relatorio-presets/route";
import { apiFetch } from "@/lib/api-fetch";

// ── Utilitários ──

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtData(iso?: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function escCSV(v: unknown): string {
  const s = String(v ?? "");
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const MESES = [
  "JAN","FEV","MAR","ABR","MAI","JUN",
  "JUL","AGO","SET","OUT","NOV","DEZ",
];

// ── Tipo para os filtros locais (strings para inputs) ──

interface FiltrosForm {
  vendedorIds: string[];
  dataInicio: string;
  dataFim: string;
  status: string;
  nfStatus: string;
  comissaoPaga: string;
}

const FILTRO_PADRAO: FiltrosForm = {
  vendedorIds: [],
  dataInicio: "",
  dataFim: "",
  status: "todas",
  nfStatus: "todas",
  comissaoPaga: "todas",
};

// ── Página ──

export default function RelatorioVendasComissoesPage() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [presets, setPresets] = useState<RelatorioPreset[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Filtros atuais
  const [filtros, setFiltros] = useState<FiltrosForm>(() => {
    // Tenta restaurar da sessionStorage
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("relatorio-vendas-filtros");
      if (saved) try { return JSON.parse(saved); } catch {}
    }
    return FILTRO_PADRAO;
  });

  // Preset sendo salvo
  const [salvandoPreset, setSalvandoPreset] = useState(false);
  const [nomePreset, setNomePreset] = useState("");
  const [mostrarSalvarPreset, setMostrarSalvarPreset] = useState(false);

  async function carregar() {
    const [resVend, resVendas, resPresets] = await Promise.all([
      apiFetch("/api/financeiro/vendas-comissoes/vendedores"),
      apiFetch("/api/financeiro/vendas-comissoes/vendas"),
      apiFetch("/api/financeiro/vendas-comissoes/relatorio-presets"),
    ]);
    setVendedores(await resVend.json());
    setVendas(await resVendas.json());
    setPresets(await resPresets.json());
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  // Persistir filtros na sessionStorage
  useEffect(() => {
    sessionStorage.setItem("relatorio-vendas-filtros", JSON.stringify(filtros));
  }, [filtros]);

  // ── Dados filtrados ──
  const vendasFiltradas = useMemo(() => {
    return vendas.filter((v) => {
      // Vendedor
      if (filtros.vendedorIds.length > 0 && !filtros.vendedorIds.includes(v.vendedorId)) return false;

      // Período
      if (filtros.dataInicio && v.data < filtros.dataInicio) return false;
      if (filtros.dataFim && v.data > filtros.dataFim) return false;

      // Status
      if (filtros.status !== "todas" && v.status !== filtros.status) return false;

      // NF Status
      if (filtros.nfStatus !== "todas") {
        if (filtros.nfStatus === "Emitida" && v.notaFiscal !== "EMITIDA") return false;
        if (filtros.nfStatus === "Pendente" && v.notaFiscal === "EMITIDA") return false;
      }

      // Comissão Paga
      if (filtros.comissaoPaga !== "todas") {
        if (filtros.comissaoPaga === "sim" && !v.comissaoPaga) return false;
        if (filtros.comissaoPaga === "nao" && v.comissaoPaga) return false;
      }

      return true;
    });
  }, [vendas, filtros]);

  // ── Totais dos filtrados ──
  const totais = useMemo(() => {
    const realizadas = vendasFiltradas.filter((v) => v.status === "Realizada");
    const totalVendas = realizadas.reduce((s, v) => s + v.valor, 0);
    const totalComissao = realizadas.reduce((s, v) => s + v.comissaoCalculada, 0);
    const pctMedia = totalVendas > 0 ? (totalComissao / totalVendas) * 100 : 0;
    return { totalVendas, totalComissao, pctMedia, qtd: realizadas.length, totalGeral: vendasFiltradas.length };
  }, [vendasFiltradas]);

  // ── Presets ──
  function aplicarPreset(p: RelatorioPreset) {
    setFiltros({
      vendedorIds: p.filtros.vendedorIds || [],
      dataInicio: p.filtros.dataInicio || "",
      dataFim: p.filtros.dataFim || "",
      status: p.filtros.status || "todas",
      nfStatus: p.filtros.nfStatus || "todas",
      comissaoPaga: p.filtros.comissaoPaga || "todas",
    });
  }

  async function salvarPreset() {
    if (!nomePreset.trim()) return;
    setSalvandoPreset(true);
    await apiFetch("/api/financeiro/vendas-comissoes/relatorio-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: nomePreset.trim(),
        filtros: {
          vendedorIds: filtros.vendedorIds,
          dataInicio: filtros.dataInicio,
          dataFim: filtros.dataFim,
          status: filtros.status,
          nfStatus: filtros.nfStatus,
          comissaoPaga: filtros.comissaoPaga,
        } as FiltrosRelatorio,
      }),
    });
    setNomePreset("");
    setMostrarSalvarPreset(false);
    setSalvandoPreset(false);
    await carregar();
  }

  async function excluirPreset(id: string) {
    if (!confirm("Excluir esta pré-definição?")) return;
    await apiFetch(`/api/financeiro/vendas-comissoes/relatorio-presets?id=${id}`, { method: "DELETE" });
    await carregar();
  }

  async function atualizarPreset(p: RelatorioPreset) {
    await apiFetch("/api/financeiro/vendas-comissoes/relatorio-presets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: p.id,
        filtros: {
          vendedorIds: filtros.vendedorIds,
          dataInicio: filtros.dataInicio,
          dataFim: filtros.dataFim,
          status: filtros.status,
          nfStatus: filtros.nfStatus,
          comissaoPaga: filtros.comissaoPaga,
        } as FiltrosRelatorio,
      }),
    });
    await carregar();
  }

  // ── Toggle vendedor ──
  function toggleVendedor(id: string) {
    setFiltros((p) => ({
      ...p,
      vendedorIds: p.vendedorIds.includes(id) ? p.vendedorIds.filter((v) => v !== id) : [...p.vendedorIds, id],
    }));
  }

  // ── Export CSV ──
  function exportarCSV() {
    const headers = [
      "Data","Vendedor","Cliente","CNPJ/CPF","NF","Emissão NF",
      "Produto/Serviço","Valor","% Comissão","Comissão","Status",
      "Comissão Paga","Data Receb.","Data Pagto.","Observação",
    ];
    const rows = vendasFiltradas.map((v) => {
      const vendedor = vendedores.find((vend) => vend.id === v.vendedorId);
      return [
        fmtData(v.data),
        vendedor?.nome || "—",
        v.cliente,
        v.cnpj || "",
        v.notaFiscal || "",
        v.dataEmissao ? fmtData(v.dataEmissao) : "",
        v.produtoServico,
        String(v.valor),
        String(v.percentualComissao) + "%",
        String(v.comissaoCalculada),
        v.status,
        v.comissaoPaga ? "Sim" : "Não",
        v.dataRecebimentoCliente ? fmtData(v.dataRecebimentoCliente) : "",
        v.dataPagamentoComissao ? fmtData(v.dataPagamentoComissao) : "",
        v.observacao || "",
      ];
    });
    const label = `relatorio-vendas-comissoes_${new Date().toISOString().slice(0, 10)}`;
    downloadCSV(`${label}.csv`, headers, rows);
  }

  // ── Export PDF ──
  async function exportarPDF() {
    const headers = [
      "Data","Vendedor","Cliente","Valor","%","Comissão","Status","Paga",
    ];
    const rows = vendasFiltradas.map((v) => {
      const vendedor = vendedores.find((vend) => vend.id === v.vendedorId);
      return [
        fmtData(v.data),
        vendedor?.nome || "—",
        v.cliente,
        `R$ ${v.valor.toFixed(2)}`,
        `${v.percentualComissao}%`,
        `R$ ${v.comissaoCalculada.toFixed(2)}`,
        v.status,
        v.comissaoPaga ? "Sim" : "Não",
      ];
    });

    const res = await apiFetch("/api/financeiro/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Relatório Vendas e Comissões`,
        subtitle: `Filtrado: ${vendasFiltradas.length} transações`,
        headers,
        rows,
      }),
    });

    if (!res.ok) { alert("Erro ao gerar PDF"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-vendas-comissoes_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Limpar filtros
  function limparFiltros() {
    setFiltros({ ...FILTRO_PADRAO });
  }

  if (carregando) {
    return (
      <WorkspaceLayout>
        <div className="p-6 text-center text-gray-400">Carregando...</div>
      </WorkspaceLayout>
    );
  }

  // Vendedores ativos para os filtros
  const vendedoresAtivos = vendedores.filter((v) => v.ativo);

  return (
    <WorkspaceLayout>
      <main className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <a href="/financeiro/vendas-comissoes" className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </a>
              <h1 className="text-xl font-bold text-gray-900">Relatório de Vendas e Comissões</h1>
            </div>
            <p className="text-sm text-gray-500 mt-0.5 ml-8">Filtre os dados e exporte relatórios personalizados.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportarCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>
            <button onClick={exportarPDF} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#fb4d06] rounded-lg hover:bg-[#e04400] transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              PDF
            </button>
          </div>
        </div>

        {/* ── PRÉ-DEFINIÇÕES ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
          <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pré-definições</h2>
            <button
              onClick={() => setMostrarSalvarPreset(!mostrarSalvarPreset)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Salvar filtros atuais
            </button>
          </div>

          {mostrarSalvarPreset && (
            <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
              <input
                type="text"
                placeholder="Nome da pré-definição..."
                className="flex-1 border border-blue-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#fb4d06]"
                value={nomePreset}
                onChange={(e) => setNomePreset(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") salvarPreset(); }}
              />
              <button onClick={salvarPreset} disabled={salvandoPreset || !nomePreset.trim()} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {salvandoPreset ? "Salvando..." : "Salvar"}
              </button>
              <button onClick={() => { setMostrarSalvarPreset(false); setNomePreset(""); }} className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition">
                Cancelar
              </button>
            </div>
          )}

          {presets.length === 0 ? (
            <div className="px-5 py-4 text-xs text-gray-400">
              Nenhuma pré-definição salva. Configure os filtros abaixo e clique em "Salvar filtros atuais".
            </div>
          ) : (
            <div className="px-5 py-3 flex flex-wrap gap-2">
              {presets.map((p) => (
                <div key={p.id} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                  <button
                    onClick={() => aplicarPreset(p)}
                    className="text-xs font-medium text-gray-700 hover:text-[#fb4d06] transition"
                    title="Aplicar pré-definição"
                  >
                    {p.nome}
                  </button>
                  <button
                    onClick={() => atualizarPreset(p)}
                    className="text-gray-300 hover:text-blue-500 transition"
                    title="Atualizar com filtros atuais"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                  <button
                    onClick={() => excluirPreset(p.id)}
                    className="text-gray-300 hover:text-red-500 transition"
                    title="Excluir pré-definição"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── FILTROS ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
          <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Filtros</h2>
            <button onClick={limparFiltros} className="text-[10px] font-medium text-gray-400 hover:text-red-500 transition">
              Limpar filtros
            </button>
          </div>
          <div className="px-5 py-4 flex flex-col gap-4">
            {/* Vendedores */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-2 block">Vendedor(es)</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFiltros((p) => ({ ...p, vendedorIds: [] }))}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition ${
                    filtros.vendedorIds.length === 0
                      ? "bg-[#fb4d06] text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  Todos
                </button>
                {vendedoresAtivos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => toggleVendedor(v.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition ${
                      filtros.vendedorIds.includes(v.id)
                        ? "bg-[#fb4d06] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {v.nome}
                  </button>
                ))}
              </div>
            </div>

            {/* Linha: Período, Status, NF, Comissão */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Data Início</label>
                <input
                  type="date"
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#fb4d06]"
                  value={filtros.dataInicio}
                  onChange={(e) => setFiltros((p) => ({ ...p, dataInicio: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Data Fim</label>
                <input
                  type="date"
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#fb4d06]"
                  value={filtros.dataFim}
                  onChange={(e) => setFiltros((p) => ({ ...p, dataFim: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Status</label>
                <select
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#fb4d06] bg-white"
                  value={filtros.status}
                  onChange={(e) => setFiltros((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="todas">Todas</option>
                  <option value="Realizada">Realizada</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Nota Fiscal</label>
                <select
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#fb4d06] bg-white"
                  value={filtros.nfStatus}
                  onChange={(e) => setFiltros((p) => ({ ...p, nfStatus: e.target.value }))}
                >
                  <option value="todas">Todas</option>
                  <option value="Emitida">Emitida</option>
                  <option value="Pendente">Pendente / A Emitir</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Comissão Paga</label>
                <select
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#fb4d06] bg-white"
                  value={filtros.comissaoPaga}
                  onChange={(e) => setFiltros((p) => ({ ...p, comissaoPaga: e.target.value }))}
                >
                  <option value="todas">Todas</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── RESUMO ── */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Transações</p>
            <p className="text-lg font-bold text-gray-800">
              {vendasFiltradas.length}
              <span className="text-xs text-red-400 font-normal ml-1">
                ({vendasFiltradas.filter((v) => v.status === "Cancelada").length} canceladas)
              </span>
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Vendas Totais</p>
            <p className="text-lg font-bold text-green-700">{fmt(totais.totalVendas)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Comissão Total</p>
            <p className="text-lg font-bold text-blue-700">{fmt(totais.totalComissao)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase">% Média</p>
            <p className="text-lg font-bold text-gray-800">{totais.pctMedia.toFixed(2)}%</p>
          </div>
        </div>

        {/* ── TABELA ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Transações
              <span className="text-gray-400 font-normal ml-2">({vendasFiltradas.length})</span>
            </h2>
          </div>

          {vendasFiltradas.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Nenhuma transação encontrada com os filtros selecionados.
            </div>
          ) : (
            <table className="w-full text-xs min-w-[1100px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Data</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Vendedor</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Cliente</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">NF</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Produto/Serviço</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Valor</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">%</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Comissão</th>
                  <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Paga</th>
                  <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Data Pagto.</th>
                </tr>
              </thead>
              <tbody>
                {vendasFiltradas.map((v) => {
                  const vendedor = vendedores.find((vend) => vend.id === v.vendedorId);
                  const nfColor = v.notaFiscal === "EMITIDA" ? "bg-green-50 text-green-700 border-green-200" : v.notaFiscal === "CANCELADA" ? "bg-red-50 text-red-600 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200";
                  return (
                    <tr key={v.id} className={`border-b border-gray-50 hover:bg-gray-50/40 ${v.status === "Cancelada" ? "opacity-50" : ""}`}>
                      <td className="px-4 py-2.5 text-gray-600">{fmtData(v.data)}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{vendedor?.nome || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{v.cliente}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${nfColor}`}>{v.notaFiscal}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 max-w-[180px] truncate">{v.produtoServico}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-800">{fmt(v.valor)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{v.percentualComissao}%</td>
                      <td className="px-4 py-2.5 text-right font-medium text-blue-700">{fmt(v.comissaoCalculada)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${v.status === "Realizada" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${v.comissaoPaga ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                          {v.comissaoPaga ? "Sim" : "Não"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-500">
                        {v.dataPagamentoComissao ? fmtData(v.dataPagamentoComissao) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </WorkspaceLayout>
  );
}
