"use client";

import { useEffect, useState, useMemo } from "react";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import type { Vendedor } from "@/app/api/financeiro/vendas-comissoes/vendedores/route";
import type { Venda } from "@/app/api/financeiro/vendas-comissoes/vendas/route";
import type { Orcamento } from "@/app/types";

// ── Utilitários ──

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MESES = [
  "JAN","FEV","MAR","ABR","MAI","JUN",
  "JUL","AGO","SET","OUT","NOV","DEZ",
];

function fmtData(iso?: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function extrairMes(iso: string) {
  return parseInt(iso.split("-")[1], 10) - 1;
}

function extrairAno(iso: string) {
  return parseInt(iso.split("-")[0], 10);
}

// ── Modal Vendedor ──

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
    cnpj: vendedor?.cnpj || "",
    banco: vendedor?.banco || "",
    agencia: vendedor?.agencia || "",
    contaCorrente: vendedor?.contaCorrente || "",
    chavePix: vendedor?.chavePix || "",
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
      cnpj: form.cnpj,
      banco: form.banco,
      agencia: form.agencia,
      contaCorrente: form.contaCorrente,
      chavePix: form.chavePix,
      percentualComissao: parseFloat(String(form.percentualComissao)) || 0,
      metaMensal: parseFloat(String(form.metaMensal)) || 0,
    });
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Nome *</label>
              <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">E-mail</label>
              <input type="email" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Telefone</label>
              <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.telefone} onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">CNPJ</label>
              <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.cnpj} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Banco</label>
              <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.banco} onChange={(e) => setForm((p) => ({ ...p, banco: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Agência</label>
              <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.agencia} onChange={(e) => setForm((p) => ({ ...p, agencia: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Conta Corrente</label>
              <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.contaCorrente} onChange={(e) => setForm((p) => ({ ...p, contaCorrente: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Chave Pix</label>
              <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.chavePix} onChange={(e) => setForm((p) => ({ ...p, chavePix: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Comissão (%)</label>
              <div className="relative">
                <input type="number" step="0.1" min="0" max="100" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] pr-6" value={form.percentualComissao} onChange={(e) => setForm((p) => ({ ...p, percentualComissao: e.target.value }))} />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Meta Mensal (R$)</label>
              <input type="number" step="0.01" min="0" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.metaMensal} onChange={(e) => setForm((p) => ({ ...p, metaMensal: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancelar</button>
            <button type="submit" disabled={salvando} className="px-4 py-2 text-sm font-medium text-white bg-[#fb4d06] rounded-lg hover:bg-[#e04400] transition disabled:opacity-50">{salvando ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal Transação ──

interface ModalTransacaoProps {
  vendedor: Vendedor;
  orcamentos: Orcamento[];
  transacao?: Venda | null;
  onClose: () => void;
  onSalvar: (dados: Partial<Venda>) => Promise<void>;
}

function ModalTransacao({ vendedor, orcamentos, transacao, onClose, onSalvar }: ModalTransacaoProps) {
  const [form, setForm] = useState({
    orcamentoId: transacao?.orcamentoId || "",
    data: transacao?.data || new Date().toISOString().split("T")[0],
    cliente: transacao?.cliente || "",
    cnpj: transacao?.cnpj || "",
    notaFiscal: transacao?.notaFiscal || "A EMITIR" as Venda["notaFiscal"],
    dataEmissao: transacao?.dataEmissao || "",
    produtoServico: transacao?.produtoServico || "",
    valor: transacao?.valor ?? "",
    percentualComissao: String(transacao?.percentualComissao ?? vendedor.percentualComissao),
    observacao: transacao?.observacao || "",
  });
  const [salvando, setSalvando] = useState(false);
  const [buscaOrc, setBuscaOrc] = useState("");

  const orcFiltrados = useMemo(() => {
    if (!buscaOrc.trim()) return orcamentos.slice(0, 20);
    const q = buscaOrc.toLowerCase();
    return orcamentos.filter((o) =>
      o.cliente.toLowerCase().includes(q) ||
      o.numero.toLowerCase().includes(q) ||
      (o.nomeProjeto || "").toLowerCase().includes(q)
    ).slice(0, 30);
  }, [orcamentos, buscaOrc]);

  function selecionarOrcamento(orc: Orcamento) {
    const subtotal = (orc.itens || []).reduce((s, it) => s + (it.total || 0), 0);
    const valor = subtotal + (orc.freteValor || 0) + (orc.custoManuseio || 0);
    setForm((p) => ({
      ...p,
      orcamentoId: orc.id,
      cliente: orc.cliente,
      cnpj: "",
      produtoServico: orc.nomeProjeto || `Orçamento #${orc.numero}`,
      valor,
    }));
    setBuscaOrc("");
  }

  const comissaoPrev = (parseFloat(String(form.valor)) || 0) * ((parseFloat(String(form.percentualComissao)) || 0) / 100);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente.trim() || !form.data || !form.valor) return;
    setSalvando(true);
    await onSalvar({
      orcamentoId: form.orcamentoId || undefined,
      data: form.data,
      cliente: form.cliente,
      cnpj: form.cnpj,
      notaFiscal: form.notaFiscal,
      dataEmissao: form.dataEmissao,
      produtoServico: form.produtoServico || form.cliente,
      valor: parseFloat(String(form.valor)) || 0,
      percentualComissao: parseFloat(String(form.percentualComissao)) || 0,
      observacao: form.observacao,
    });
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            {transacao ? "Editar Transação" : "Nova Transação"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {/* Seletor de Orçamento */}
          {!transacao && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <label className="text-xs font-semibold text-blue-700 mb-2 block">Vincular a um Orçamento</label>
              <input
                type="text"
                placeholder="Buscar orçamento por cliente, nº ou nome do projeto..."
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] mb-2"
                value={buscaOrc}
                onChange={(e) => setBuscaOrc(e.target.value)}
              />
              {buscaOrc && (
                <div className="max-h-40 overflow-y-auto border border-blue-100 rounded-lg bg-white divide-y divide-gray-50">
                  {orcFiltrados.map((orc) => (
                    <button
                      key={orc.id}
                      type="button"
                      onClick={() => selecionarOrcamento(orc)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition flex items-center gap-3"
                    >
                      <span className="font-medium text-gray-800 shrink-0">#{orc.numero}</span>
                      <span className="text-gray-600 truncate">{orc.cliente}</span>
                      {orc.nomeProjeto && <span className="text-gray-400 truncate">— {orc.nomeProjeto}</span>}
                    </button>
                  ))}
                  {orcFiltrados.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">Nenhum orçamento encontrado</p>}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Data *</label>
              <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Cliente *</label>
              <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.cliente} onChange={(e) => setForm((p) => ({ ...p, cliente: e.target.value }))} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">CNPJ/CPF</label>
              <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.cnpj} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Produto/Serviço</label>
              <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.produtoServico} onChange={(e) => setForm((p) => ({ ...p, produtoServico: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Valor (R$) *</label>
              <input type="number" step="0.01" min="0" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.valor} onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Comissão (%)</label>
              <div className="relative">
                <input type="number" step="0.1" min="0" max="100" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] pr-6" value={form.percentualComissao} onChange={(e) => setForm((p) => ({ ...p, percentualComissao: e.target.value }))} />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Nota Fiscal</label>
              <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] bg-white" value={form.notaFiscal} onChange={(e) => setForm((p) => ({ ...p, notaFiscal: e.target.value as Venda["notaFiscal"] }))}>
                <option value="A EMITIR">A EMITIR</option>
                <option value="EMITIDA">EMITIDA</option>
                <option value="CANCELADA">CANCELADA</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Data Emissão NF</label>
              <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]" value={form.dataEmissao} onChange={(e) => setForm((p) => ({ ...p, dataEmissao: e.target.value }))} />
            </div>
          </div>

          {comissaoPrev > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
              <span className="text-blue-700 font-medium">Comissão calculada: {fmt(comissaoPrev)}</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Observação</label>
            <textarea className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] resize-none" rows={2} value={form.observacao} onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancelar</button>
            <button type="submit" disabled={salvando} className="px-4 py-2 text-sm font-medium text-white bg-[#fb4d06] rounded-lg hover:bg-[#e04400] transition disabled:opacity-50">{salvando ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page Principal ──

export default function VendasComissoesPage() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [vendedorSelId, setVendedorSelId] = useState<string>("");
  const [anoSel, setAnoSel] = useState(new Date().getFullYear());

  // Modais
  const [modalVendedor, setModalVendedor] = useState<{ aberto: boolean; editar?: Vendedor | null }>({ aberto: false });
  const [modalTransacao, setModalTransacao] = useState<{ aberto: boolean; editar?: Venda | null }>({ aberto: false });

  async function carregar() {
    const [resVend, resVendas, resOrc] = await Promise.all([
      fetch("/api/financeiro/vendas-comissoes/vendedores"),
      fetch("/api/financeiro/vendas-comissoes/vendas"),
      fetch("/api/orcamentos"),
    ]);
    const dataVend: Vendedor[] = await resVend.json();
    const dataVendas: Venda[] = await resVendas.json();
    const dataOrc: Orcamento[] = await resOrc.json();
    setVendedores(dataVend);
    setVendas(dataVendas);
    setOrcamentos(dataOrc.filter((o) => o.status === "Aprovado" || o.status === "Enviado"));
    if (!vendedorSelId && dataVend.length > 0) setVendedorSelId(dataVend[0].id);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  const vendedorAtual = vendedores.find((v) => v.id === vendedorSelId);

  // Vendas do vendedor selecionado no ano selecionado
  const vendasVendedor = useMemo(() => {
    return vendas.filter((v) => {
      if (v.vendedorId !== vendedorSelId) return false;
      const mesAno = extrairAno(v.data);
      return mesAno === anoSel;
    });
  }, [vendas, vendedorSelId, anoSel]);

  // Totais
  const totais = useMemo(() => {
    const realizadas = vendasVendedor.filter((v) => v.status === "Realizada");
    const totalVendas = realizadas.reduce((s, v) => s + v.valor, 0);
    const totalComissao = realizadas.reduce((s, v) => s + v.comissaoCalculada, 0);
    const pctMedia = totalVendas > 0 ? (totalComissao / totalVendas) * 100 : 0;
    const qtdTransacoes = realizadas.length;
    const canceladas = vendasVendedor.filter((v) => v.status === "Cancelada").length;
    return { totalVendas, totalComissao, pctMedia, qtdTransacoes, canceladas };
  }, [vendasVendedor]);

  // Resumo por mês
  const resumoMensal = useMemo(() => {
    return MESES.map((_, idx) => {
      const doMes = vendasVendedor.filter((v) => {
        if (v.status !== "Realizada") return false;
        return extrairMes(v.data) === idx;
      });
      const vendas = doMes.reduce((s, v) => s + v.valor, 0);
      const comissoes = doMes.reduce((s, v) => s + v.comissaoCalculada, 0);
      const qtd = doMes.length;
      return { vendas, comissoes, qtd };
    });
  }, [vendasVendedor]);

  // ── CRUD ──

  async function salvarVendedor(dados: Partial<Vendedor>) {
    if (modalVendedor.editar) {
      await fetch("/api/financeiro/vendas-comissoes/vendedores", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, id: modalVendedor.editar.id }),
      });
    } else {
      await fetch("/api/financeiro/vendas-comissoes/vendedores", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
    }
    setModalVendedor({ aberto: false });
    await carregar();
  }

  async function toggleAtivo(v: Vendedor) {
    await fetch("/api/financeiro/vendas-comissoes/vendedores", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, ativo: !v.ativo }),
    });
    await carregar();
  }

  async function excluirVendedor(id: string) {
    if (!confirm("Tem certeza?")) return;
    await fetch(`/api/financeiro/vendas-comissoes/vendedores?id=${id}`, { method: "DELETE" });
    await carregar();
  }

  async function salvarTransacao(dados: Partial<Venda>) {
    if (modalTransacao.editar) {
      await fetch("/api/financeiro/vendas-comissoes/vendas", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, id: modalTransacao.editar.id, vendedorId: vendedorSelId }),
      });
    } else {
      await fetch("/api/financeiro/vendas-comissoes/vendas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, vendedorId: vendedorSelId }),
      });
    }
    setModalTransacao({ aberto: false });
    await carregar();
  }

  async function toggleComissaoPaga(v: Venda) {
    await fetch("/api/financeiro/vendas-comissoes/vendas", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, comissaoPaga: !v.comissaoPaga }),
    });
    await carregar();
  }

  async function cancelarTransacao(v: Venda) {
    if (!confirm("Cancelar esta transação?")) return;
    await fetch("/api/financeiro/vendas-comissoes/vendas", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, status: "Cancelada" }),
    });
    await carregar();
  }

  async function excluirTransacao(id: string) {
    if (!confirm("Excluir transação?")) return;
    await fetch(`/api/financeiro/vendas-comissoes/vendas?id=${id}`, { method: "DELETE" });
    await carregar();
  }

  const anosDisponiveis = useMemo(() => {
    const anos = new Set(vendas.map((v) => extrairAno(v.data)));
    if (anos.size === 0) anos.add(new Date().getFullYear());
    return [...anos].sort((a, b) => b - a);
  }, [vendas]);

  if (carregando) {
    return (
      <WorkspaceLayout>
        <div className="p-6 text-center text-gray-400">Carregando...</div>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout>
      <main className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Vendas e Comissões</h1>
            <p className="text-sm text-gray-500 mt-0.5">Acompanhamento de vendas e comissões da equipe.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setModalVendedor({ aberto: true })} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Novo Vendedor
            </button>
            {vendedorAtual && (
              <button onClick={() => {
                if (vendedorAtual) setModalVendedor({ aberto: true, editar: vendedorAtual });
              }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#fb4d06] rounded-lg hover:bg-[#e04400] transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Editar Vendedor
              </button>
            )}
          </div>
        </div>

        {/* Seletor de Vendedor + Ano */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {vendedores.filter((v) => v.ativo).map((v) => (
            <button
              key={v.id}
              onClick={() => setVendedorSelId(v.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                vendedorSelId === v.id
                  ? "bg-[#fb4d06] text-white shadow-md"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {v.nome}
            </button>
          ))}
          <select
            className="ml-auto border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#fb4d06] bg-white"
            value={anoSel}
            onChange={(e) => setAnoSel(parseInt(e.target.value))}
          >
            {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {!vendedorAtual ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <p className="mb-2">Nenhum vendedor selecionado.</p>
            <p className="text-xs">Selecione ou cadastre um vendedor acima.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* ── CADASTRO DO VENDEDOR ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Cadastro do Vendedor</h2>
              </div>
              <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div><span className="text-gray-400 block">Nome</span><span className="font-medium text-gray-800">{vendedorAtual.nome}</span></div>
                <div><span className="text-gray-400 block">CNPJ</span><span className="font-medium text-gray-800">{vendedorAtual.cnpj || "—"}</span></div>
                <div><span className="text-gray-400 block">Banco</span><span className="font-medium text-gray-800">{vendedorAtual.banco || "—"}</span></div>
                <div><span className="text-gray-400 block">Agência</span><span className="font-medium text-gray-800">{vendedorAtual.agencia || "—"}</span></div>
                <div><span className="text-gray-400 block">Conta Corrente</span><span className="font-medium text-gray-800">{vendedorAtual.contaCorrente || "—"}</span></div>
                <div><span className="text-gray-400 block">Chave Pix</span><span className="font-medium text-gray-800">{vendedorAtual.chavePix || "—"}</span></div>
                <div><span className="text-gray-400 block">E-mail</span><span className="font-medium text-gray-800">{vendedorAtual.email || "—"}</span></div>
                <div><span className="text-gray-400 block">Comissão Padrão</span><span className="font-medium text-gray-800">{vendedorAtual.percentualComissao}%</span></div>
              </div>
            </div>

            {/* ── RESUMO ANUAL ── */}
            <div className="grid grid-cols-4 gap-4">
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
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase">Transações</p>
                <p className="text-lg font-bold text-gray-800">{totais.qtdTransacoes} <span className="text-xs text-red-400 font-normal">({totais.canceladas} canceladas)</span></p>
              </div>
            </div>

            {/* ── RESUMO MENSAL ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <div className="px-5 py-3 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Resumo Mensal {anoSel}</h2>
              </div>
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Mês</th>
                    {MESES.map((m) => <th key={m} className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-700 text-[11px]">Vendas</td>
                    {resumoMensal.map((r, i) => (
                      <td key={i} className="px-3 py-2.5 text-right font-medium text-gray-800">{r.vendas > 0 ? fmt(r.vendas) : "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-medium text-blue-700 text-[11px]">Comissão</td>
                    {resumoMensal.map((r, i) => (
                      <td key={i} className="px-3 py-2.5 text-right font-medium text-blue-700">{r.comissoes > 0 ? fmt(r.comissoes) : "—"}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── TRANSAÇÕES DETALHADAS ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Transações Detalhadas</h2>
                <button
                  onClick={() => setModalTransacao({ aberto: true })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#fb4d06] rounded-lg hover:bg-[#e04400] transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Nova Transação
                </button>
              </div>
              {vendasVendedor.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p>Nenhuma transação em {anoSel}.</p>
                  <p className="text-xs mt-1">Clique em "Nova Transação" para adicionar.</p>
                </div>
              ) : (
                <table className="w-full text-xs min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Data</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Cliente</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">CNPJ/CPF</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">NF</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Emissão</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Produto/Serviço</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Valor</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">%</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Comissão</th>
                      <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Paga</th>
                      <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendasVendedor.map((v) => {
                      const nfColor = v.notaFiscal === "EMITIDA" ? "bg-green-50 text-green-700 border-green-200" : v.notaFiscal === "CANCELADA" ? "bg-red-50 text-red-600 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200";
                      return (
                        <tr key={v.id} className={`border-b border-gray-50 hover:bg-gray-50/40 ${v.status === "Cancelada" ? "opacity-50" : ""}`}>
                          <td className="px-4 py-2.5 text-gray-600">{fmtData(v.data)}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-800">{v.cliente}</td>
                          <td className="px-4 py-2.5 text-gray-500">{v.cnpj || "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${nfColor}`}>{v.notaFiscal}</span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">{v.dataEmissao ? fmtData(v.dataEmissao) : "—"}</td>
                          <td className="px-4 py-2.5 text-gray-600 max-w-[200px] truncate">{v.produtoServico}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-800">{fmt(v.valor)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{v.percentualComissao}%</td>
                          <td className="px-4 py-2.5 text-right font-medium text-blue-700">{fmt(v.comissaoCalculada)}</td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={() => toggleComissaoPaga(v)}
                              className={`inline-flex h-5 w-9 rounded-full transition-colors ${v.comissaoPaga ? "bg-green-500" : "bg-gray-200"}`}
                            >
                              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${v.comissaoPaga ? "translate-x-4" : "translate-x-0.5"}`} />
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => setModalTransacao({ aberto: true, editar: v })} className="text-gray-400 hover:text-blue-500 transition" title="Editar">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              {v.status === "Realizada" && (
                                <button onClick={() => cancelarTransacao(v)} className="text-gray-400 hover:text-red-500 transition" title="Cancelar">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                              <button onClick={() => excluirTransacao(v.id)} className="text-gray-400 hover:text-red-500 transition" title="Excluir">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── COMISSÕES POR MÊS ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <div className="px-5 py-3 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Comissões por Mês</h2>
              </div>
              <table className="w-full text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Mês</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Valor Comissão</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Paga</th>
                  </tr>
                </thead>
                <tbody>
                  {MESES.map((m, idx) => {
                    const doMes = vendasVendedor.filter((v) => v.status === "Realizada" && extrairMes(v.data) === idx);
                    const totalComissao = doMes.reduce((s, v) => s + v.comissaoCalculada, 0);
                    const todasPagas = doMes.length > 0 && doMes.every((v) => v.comissaoPaga);
                    return (
                      <tr key={m} className="border-b border-gray-50 hover:bg-gray-50/40">
                        <td className="px-4 py-2.5 font-medium text-gray-700">{m}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-blue-700">{totalComissao > 0 ? fmt(totalComissao) : "—"}</td>
                        <td className="px-4 py-2.5 text-center">
                          {totalComissao > 0 && (
                            <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              todasPagas ? "bg-green-50 text-green-700 border border-green-200" : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                            }`}>
                              {todasPagas ? "Pago" : "Pendente"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modais */}
        {modalVendedor.aberto && (
          <ModalVendedor vendedor={modalVendedor.editar} onClose={() => setModalVendedor({ aberto: false })} onSalvar={salvarVendedor} />
        )}
        {modalTransacao.aberto && vendedorAtual && (
          <ModalTransacao vendedor={vendedorAtual} orcamentos={orcamentos} transacao={modalTransacao.editar} onClose={() => setModalTransacao({ aberto: false })} onSalvar={salvarTransacao} />
        )}
      </main>
    </WorkspaceLayout>
  );
}
