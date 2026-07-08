"use client";

import { useEffect, useState, useMemo } from "react";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import type { Vendedor } from "@/app/api/financeiro/vendas-comissoes/vendedores/route";
import type { Venda } from "@/app/api/financeiro/vendas-comissoes/vendas/route";

// ── Tipos locais ──

type Tab = "equipe" | "vendas" | "dashboard";

// ── Utilitários ──

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function fmtData(iso?: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Modal de Vendedor ──

interface ModalVendedorProps {
  vendedor?: Vendedor | null;
  onClose: () => void;
  onSalvar: (dados: Partial<Vendedor>) => Promise<void>;
}

function ModalVendedor({ vendedor, onClose, onSalvar }: ModalVendedorProps) {
  const [form, setForm] = useState({
    nome: vendedor?.nome || "",
    email: vendedor?.email || "",
    telefone: vendedor?.telefone || "",
    percentualComissao: vendedor?.percentualComissao ?? "",
    metaMensal: vendedor?.metaMensal ?? "",
  });
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSalvando(true);
    await onSalvar({
      nome: form.nome,
      email: form.email,
      telefone: form.telefone,
      percentualComissao: parseFloat(String(form.percentualComissao)) || 0,
      metaMensal: parseFloat(String(form.metaMensal)) || 0,
    });
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            {vendedor ? "Editar Vendedor" : "Novo Vendedor"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Nome *</label>
            <input
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
              value={form.nome}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">E-mail</label>
            <input
              type="email"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Telefone</label>
            <input
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
              value={form.telefone}
              onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Comissão (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] pr-6"
                  value={form.percentualComissao}
                  onChange={(e) => setForm((p) => ({ ...p, percentualComissao: e.target.value }))}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Meta Mensal (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.metaMensal}
                onChange={(e) => setForm((p) => ({ ...p, metaMensal: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-4 py-2 text-sm font-medium text-white bg-[#fb4d06] rounded-lg hover:bg-[#e04400] transition disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal de Venda ──

interface ModalVendaProps {
  vendedores: Vendedor[];
  venda?: Venda | null;
  onClose: () => void;
  onSalvar: (dados: Partial<Venda>) => Promise<void>;
}

function ModalVenda({ vendedores, venda, onClose, onSalvar }: ModalVendaProps) {
  const [form, setForm] = useState({
    vendedorId: venda?.vendedorId || (vendedores[0]?.id || ""),
    cliente: venda?.cliente || "",
    data: venda?.data || new Date().toISOString().split("T")[0],
    valor: venda?.valor ?? "",
    percentualComissao: venda?.percentualComissao ?? "",
    status: venda?.status || "Realizada",
    observacao: venda?.observacao || "",
  });
  const [salvando, setSalvando] = useState(false);

  const vendedorSel = vendedores.find((v) => v.id === form.vendedorId);

  // Auto-preenche % do vendedor quando seleciona
  useEffect(() => {
    if (!venda && vendedorSel && form.percentualComissao === "") {
      setForm((p) => ({ ...p, percentualComissao: vendedorSel.percentualComissao }));
    }
  }, [form.vendedorId, vendedorSel, venda, form.percentualComissao]);

  const comissaoPrev = (parseFloat(String(form.valor)) || 0) * ((parseFloat(String(form.percentualComissao)) || 0) / 100);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendedorId || !form.cliente.trim() || !form.data || !form.valor) return;
    setSalvando(true);
    await onSalvar({
      vendedorId: form.vendedorId,
      cliente: form.cliente,
      data: form.data,
      valor: parseFloat(String(form.valor)) || 0,
      percentualComissao: parseFloat(String(form.percentualComissao)) || 0,
      status: form.status as "Realizada" | "Cancelada",
      observacao: form.observacao,
    });
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            {venda ? "Editar Venda" : "Nova Venda"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Vendedor *</label>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] bg-white"
                value={form.vendedorId}
                onChange={(e) => setForm((p) => ({ ...p, vendedorId: e.target.value }))}
                required
              >
                <option value="">Selecione</option>
                {vendedores.filter((v) => v.ativo).map((v) => (
                  <option key={v.id} value={v.id}>{v.nome}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Cliente *</label>
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.cliente}
                onChange={(e) => setForm((p) => ({ ...p, cliente: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Data *</label>
              <input
                type="date"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.data}
                onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.valor}
                onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Comissão (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] pr-6"
                  value={form.percentualComissao}
                  onChange={(e) => setForm((p) => ({ ...p, percentualComissao: e.target.value }))}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Status</label>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] bg-white"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as "Realizada" | "Cancelada" }))}
              >
                <option>Realizada</option>
                <option>Cancelada</option>
              </select>
            </div>
          </div>

          {/* Preview comissão */}
          {comissaoPrev > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
              <span className="text-blue-700 font-medium">
                Comissão calculada: {fmt(comissaoPrev)}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Observação</label>
            <textarea
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] resize-none"
              rows={2}
              value={form.observacao}
              onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-4 py-2 text-sm font-medium text-white bg-[#fb4d06] rounded-lg hover:bg-[#e04400] transition disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page Principal ──

export default function VendasComissoesPage() {
  const [tab, setTab] = useState<Tab>("equipe");
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Modais
  const [modalVendedor, setModalVendedor] = useState<{ aberto: boolean; editar?: Vendedor | null }>({ aberto: false });
  const [modalVenda, setModalVenda] = useState<{ aberto: boolean; editar?: Venda | null }>({ aberto: false });

  // Filtros vendas
  const hoje = new Date();
  const [mesSel, setMesSel] = useState(hoje.getMonth());
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());
  const [vendedorFiltro, setVendedorFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  async function carregar() {
    const [resVend, resVendas] = await Promise.all([
      fetch("/api/financeiro/vendas-comissoes/vendedores"),
      fetch("/api/financeiro/vendas-comissoes/vendas"),
    ]);
    setVendedores(await resVend.json());
    setVendas(await resVendas.json());
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  // ── CRUD Vendedor ──

  async function salvarVendedor(dados: Partial<Vendedor>) {
    if (modalVendedor.editar) {
      await fetch("/api/financeiro/vendas-comissoes/vendedores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, id: modalVendedor.editar.id }),
      });
    } else {
      await fetch("/api/financeiro/vendas-comissoes/vendedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
    }
    setModalVendedor({ aberto: false });
    await carregar();
  }

  async function toggleAtivo(v: Vendedor) {
    await fetch("/api/financeiro/vendas-comissoes/vendedores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, ativo: !v.ativo }),
    });
    await carregar();
  }

  async function excluirVendedor(id: string) {
    if (!confirm("Tem certeza que deseja excluir este vendedor?")) return;
    await fetch(`/api/financeiro/vendas-comissoes/vendedores?id=${id}`, { method: "DELETE" });
    await carregar();
  }

  // ── CRUD Venda ──

  async function salvarVenda(dados: Partial<Venda>) {
    if (modalVenda.editar) {
      await fetch("/api/financeiro/vendas-comissoes/vendas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, id: modalVenda.editar.id }),
      });
    } else {
      await fetch("/api/financeiro/vendas-comissoes/vendas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
    }
    setModalVenda({ aberto: false });
    await carregar();
  }

  async function cancelarVenda(v: Venda) {
    if (!confirm("Cancelar esta venda?")) return;
    await fetch("/api/financeiro/vendas-comissoes/vendas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, status: "Cancelada" }),
    });
    await carregar();
  }

  async function excluirVenda(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta venda?")) return;
    await fetch(`/api/financeiro/vendas-comissoes/vendas?id=${id}`, { method: "DELETE" });
    await carregar();
  }

  // ── Filtros ──

  const vendasFiltradas = useMemo(() => {
    return vendas.filter((v) => {
      const d = new Date(v.data + "T12:00:00");
      if (d.getMonth() !== mesSel || d.getFullYear() !== anoSel) return false;
      if (vendedorFiltro !== "todos" && v.vendedorId !== vendedorFiltro) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const vendedor = vendedores.find((vend) => vend.id === v.vendedorId);
        if (!v.cliente.toLowerCase().includes(q) && !vendedor?.nome.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [vendas, mesSel, anoSel, vendedorFiltro, busca, vendedores]);

  // ── KPIs ──

  const kpis = useMemo(() => {
    const ativos = vendedores.filter((v) => v.ativo);
    const totalVendas = vendasFiltradas.reduce((s, v) => s + (v.status === "Realizada" ? v.valor : 0), 0);
    const totalComissoes = vendasFiltradas.reduce((s, v) => s + (v.status === "Realizada" ? v.comissaoCalculada : 0), 0);
    const totalCanceladas = vendasFiltradas.filter((v) => v.status === "Cancelada").length;

    // KPIs por vendedor
    const porVendedor = ativos.map((vend) => {
      const vendasVend = vendasFiltradas.filter((v) => v.vendedorId === vend.id);
      const realizadas = vendasVend.filter((v) => v.status === "Realizada");
      const totalVendido = realizadas.reduce((s, v) => s + v.valor, 0);
      const totalComissao = realizadas.reduce((s, v) => s + v.comissaoCalculada, 0);
      const metaAtingida = vend.metaMensal && vend.metaMensal > 0
        ? (totalVendido / vend.metaMensal) * 100
        : null;
      return { vendedor: vend, totalVendido, totalComissao, qtdVendas: realizadas.length, metaAtingida };
    });

    return { ativos, totalVendas, totalComissoes, totalCanceladas, porVendedor };
  }, [vendedores, vendasFiltradas]);

  // ── Lookup de vendedor ──

  function nomeVendedor(id: string) {
    return vendedores.find((v) => v.id === id)?.nome || id;
  }

  return (
    <WorkspaceLayout>
      <main className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Vendas e Comissões</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gerencie sua equipe comercial e acompanhe os resultados.</p>
          </div>
          <div className="flex items-center gap-3">
            {tab === "equipe" && (
              <button
                onClick={() => setModalVendedor({ aberto: true })}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#fb4d06] rounded-lg hover:bg-[#e04400] transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Novo Vendedor
              </button>
            )}
            {tab === "vendas" && (
              <button
                onClick={() => setModalVenda({ aberto: true })}
                disabled={vendedores.filter((v) => v.ativo).length === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#fb4d06] rounded-lg hover:bg-[#e04400] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nova Venda
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {[
            { key: "equipe" as Tab, label: "Equipe Comercial", icone: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
            { key: "vendas" as Tab, label: "Vendas", icone: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
            { key: "dashboard" as Tab, label: "Dashboard", icone: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
          ].map(({ key, label, icone }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                tab === key
                  ? "border-[#fb4d06] text-[#fb4d06]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icone} />
              </svg>
              {label}
            </button>
          ))}
        </div>

        {carregando ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : (
          <>
            {/* ── ABA: Equipe Comercial ── */}
            {tab === "equipe" && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {vendedores.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="mb-2">Nenhum vendedor cadastrado.</p>
                    <p className="text-xs">Clique em "Novo Vendedor" para começar.</p>
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/80">
                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">Nome</th>
                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">E-mail</th>
                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">Telefone</th>
                        <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">Comissão</th>
                        <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">Meta Mensal</th>
                        <th className="text-center px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">Ativo</th>
                        <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendedores.map((v) => (
                        <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50/40">
                          <td className="px-4 py-3 font-medium text-gray-800">{v.nome}</td>
                          <td className="px-4 py-3 text-gray-500">{v.email || "—"}</td>
                          <td className="px-4 py-3 text-gray-500">{v.telefone || "—"}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800">{v.percentualComissao}%</td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {v.metaMensal ? fmt(v.metaMensal) : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggleAtivo(v)}
                              className={`inline-flex h-5 w-9 rounded-full transition-colors ${v.ativo ? "bg-green-500" : "bg-gray-200"}`}
                            >
                              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${v.ativo ? "translate-x-4" : "translate-x-0.5"}`} />
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setModalVendedor({ aberto: true, editar: v })}
                                className="text-gray-400 hover:text-blue-500 transition"
                                title="Editar"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => excluirVendedor(v.id)}
                                className="text-gray-400 hover:text-red-500 transition"
                                title="Excluir"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── ABA: Vendas ── */}
            {tab === "vendas" && (
              <>
                {/* Filtros */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#fb4d06] bg-white"
                    value={mesSel}
                    onChange={(e) => setMesSel(parseInt(e.target.value))}
                  >
                    {MESES.map((m, i) => (
                      <option key={i} value={i}>{m}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#fb4d06] w-20"
                    value={anoSel}
                    onChange={(e) => setAnoSel(parseInt(e.target.value) || new Date().getFullYear())}
                  />
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#fb4d06] bg-white"
                    value={vendedorFiltro}
                    onChange={(e) => setVendedorFiltro(e.target.value)}
                  >
                    <option value="todos">Todos os vendedores</option>
                    {vendedores.filter((v) => v.ativo).map((v) => (
                      <option key={v.id} value={v.id}>{v.nome}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    className="border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#fb4d06] flex-1 min-w-[200px]"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>

                {/* Resumo */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase">Total Vendido</p>
                    <p className="text-lg font-bold text-green-700">{fmt(kpis.totalVendas)}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase">Comissões</p>
                    <p className="text-lg font-bold text-blue-700">{fmt(kpis.totalComissoes)}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase">Canceladas</p>
                    <p className="text-lg font-bold text-red-600">{kpis.totalCanceladas}</p>
                  </div>
                </div>

                {/* Tabela */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                  {vendasFiltradas.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">Nenhuma venda encontrada.</div>
                  ) : (
                    <table className="w-full text-xs min-w-[700px]">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/80">
                          <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">Vendedor</th>
                          <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">Cliente</th>
                          <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">Data</th>
                          <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">Valor</th>
                          <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">%</th>
                          <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">Comissão</th>
                          <th className="text-center px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">Status</th>
                          <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendasFiltradas.map((v) => (
                          <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50/40">
                            <td className="px-4 py-3 font-medium text-gray-800">{nomeVendedor(v.vendedorId)}</td>
                            <td className="px-4 py-3 text-gray-600">{v.cliente}</td>
                            <td className="px-4 py-3 text-gray-500">{fmtData(v.data)}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(v.valor)}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{v.percentualComissao}%</td>
                            <td className="px-4 py-3 text-right font-medium text-blue-700">{fmt(v.comissaoCalculada)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                v.status === "Realizada"
                                  ? "bg-green-50 text-green-700 border border-green-200"
                                  : "bg-red-50 text-red-600 border border-red-200"
                              }`}>
                                {v.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {v.status === "Realizada" && (
                                  <button
                                    onClick={() => cancelarVenda(v)}
                                    className="text-gray-400 hover:text-red-500 transition"
                                    title="Cancelar venda"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                                <button
                                  onClick={() => setModalVenda({ aberto: true, editar: v })}
                                  className="text-gray-400 hover:text-blue-500 transition"
                                  title="Editar"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => excluirVenda(v.id)}
                                  className="text-gray-400 hover:text-red-500 transition"
                                  title="Excluir"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {/* ── ABA: Dashboard ── */}
            {tab === "dashboard" && (
              <div className="flex flex-col gap-6">
                {/* KPIs gerais */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase">Vendedores Ativos</p>
                    <p className="text-2xl font-bold text-gray-800">{kpis.ativos.length}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase">Total Vendido</p>
                    <p className="text-2xl font-bold text-green-700">{fmt(kpis.totalVendas)}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase">Total Comissões</p>
                    <p className="text-2xl font-bold text-blue-700">{fmt(kpis.totalComissoes)}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase">Canceladas</p>
                    <p className="text-2xl font-bold text-red-600">{kpis.totalCanceladas}</p>
                  </div>
                </div>

                {/* Cards por vendedor */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {kpis.porVendedor.map(({ vendedor, totalVendido, totalComissao, qtdVendas, metaAtingida }) => (
                    <div key={vendedor.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-[#fb4d06] flex items-center justify-center text-sm font-bold text-white shrink-0">
                          {vendedor.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800">{vendedor.nome}</h3>
                          <p className="text-[10px] text-gray-400">{vendedor.percentualComissao}% de comissão</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-[9px] font-semibold text-gray-500 uppercase">Vendas</p>
                          <p className="text-sm font-bold text-gray-800">{qtdVendas}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-semibold text-gray-500 uppercase">Total</p>
                          <p className="text-sm font-bold text-green-700">{fmt(totalVendido)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-semibold text-gray-500 uppercase">Comissão</p>
                          <p className="text-sm font-bold text-blue-700">{fmt(totalComissao)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-semibold text-gray-500 uppercase">Meta</p>
                          <p className="text-sm font-bold text-gray-800">
                            {vendedor.metaMensal ? fmt(vendedor.metaMensal) : "—"}
                          </p>
                        </div>
                      </div>

                      {/* Barra de meta */}
                      {metaAtingida !== null && (
                        <div>
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-gray-500">Meta atingida</span>
                            <span className={`font-semibold ${metaAtingida >= 100 ? "text-green-600" : metaAtingida >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                              {metaAtingida.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                metaAtingida >= 100 ? "bg-green-500" : metaAtingida >= 50 ? "bg-yellow-500" : "bg-red-500"
                              }`}
                              style={{ width: `${Math.min(metaAtingida, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {metaAtingida === null && (
                        <p className="text-[10px] text-gray-400 italic">Nenhuma meta definida</p>
                      )}
                    </div>
                  ))}
                </div>

                {kpis.porVendedor.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <p>Nenhum vendedor ativo ou venda no período.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Modais */}
        {modalVendedor.aberto && (
          <ModalVendedor
            vendedor={modalVendedor.editar}
            onClose={() => setModalVendedor({ aberto: false })}
            onSalvar={salvarVendedor}
          />
        )}

        {modalVenda.aberto && (
          <ModalVenda
            vendedores={vendedores}
            venda={modalVenda.editar}
            onClose={() => setModalVenda({ aberto: false })}
            onSalvar={salvarVenda}
          />
        )}
      </main>
    </WorkspaceLayout>
  );
}
