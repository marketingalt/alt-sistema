"use client";

import { useEffect, useState, useMemo } from "react";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";

interface Lancamento {
  id: string;
  data: string;
  modalidade: string;
  banco: string;
  valor: number;
  area: string;
  categoria: string;
  obs: string;
  ordemServicoId?: string;
  contaPagarId?: string;
  comprovanteUrl?: string;
  createdAt: string;
}

interface ContaPagarItem {
  id: string;
  fornecedor: string;
  descricao: string;
  valor: number;
  status: string;
  dataVencimento: string;
  fluxoCaixaId?: string;
  ordemServicoId?: string;
}

interface OrdemServicoItem {
  id: string;
  numero: string;
  cliente: string;
  orcamentoId?: string;
}

interface DadosCaixa {
  saldoInicial: number;
  saldoInicialData: string;
  lancamentos: Lancamento[];
}

const CATEGORIAS = [
  "RECEITA OPERACIONAL BRUTA",
  "CUSTOS DIRETOS DOS SERVIÇOS",
  "DESPESAS ADM E GERAIS",
  "DESPESAS COM PESSOAL OPERACIONAL",
  "DESPESAS COM PESSOAL — PROLABORE",
  "DEDUÇÕES DA RECEITA (IMPOSTOS)",
  "DESPESAS COMERCIAIS",
  "RESULTADO FINANCEIRO",
  "EMPRÉSTIMO THIEMY",
  "EMPRÉSTIMO FERNANDO",
  "DEVOLUÇÃO THIEMY",
  "DEVOLUÇÃO FERNANDO",
  "ESTORNO",
];

const MODALIDADES = ["PIX", "TED", "DÉBITO", "BOLETO", "FATURA", "INVESTIMENTO", "TRANSFERENCIA"];
const AREAS = ["PROJETOS", "DIGITAL", "MISTO", "ESTORNO"];

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const COR_BANCO_PADRAO: Record<string, { cor: string; bg: string; abrev: string }> = {
  "C6 BANK": { cor: "text-yellow-700", bg: "bg-yellow-50", abrev: "C6" },
  "Banco Itaú": { cor: "text-blue-700", bg: "bg-blue-50", abrev: "Itaú" },
  "NUBANK": { cor: "text-purple-700", bg: "bg-purple-50", abrev: "Nubank" },
};
function corBanco(banco: string) {
  return COR_BANCO_PADRAO[banco] || { cor: "text-gray-700", bg: "bg-gray-50", abrev: banco.substring(0, 6) };
}

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return "R$ 0,00";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function corCategoria(cat: string | null | undefined): string {
  if (!cat) return "text-gray-400";
  if (cat.includes("RECEITA") || cat.includes("EMPRÉSTIMO")) return "text-green-700";
  if (cat.includes("ESTORNO")) return "text-blue-600";
  if (cat.includes("DEVOLUÇÃO")) return "text-orange-600";
  return "text-red-600";
}

const GRUPOS_DRE: { label: string; cats: string[]; cor: string }[] = [
  { label: "Receita Operacional Bruta", cats: ["RECEITA OPERACIONAL BRUTA"], cor: "text-green-700" },
  { label: "Deduções (Impostos)", cats: ["DEDUÇÕES DA RECEITA (IMPOSTOS)"], cor: "text-red-500" },
  { label: "Custos Diretos dos Serviços", cats: ["CUSTOS DIRETOS DOS SERVIÇOS"], cor: "text-orange-600" },
  { label: "Despesas com Pessoal", cats: ["DESPESAS COM PESSOAL OPERACIONAL", "DESPESAS COM PESSOAL — PROLABORE"], cor: "text-purple-600" },
  { label: "Despesas ADM e Gerais", cats: ["DESPESAS ADM E GERAIS"], cor: "text-gray-600" },
  { label: "Despesas Comerciais", cats: ["DESPESAS COMERCIAIS"], cor: "text-yellow-700" },
  { label: "Resultado Financeiro", cats: ["RESULTADO FINANCEIRO"], cor: "text-gray-500" },
  { label: "Empréstimos / Devolução", cats: ["EMPRÉSTIMO THIEMY", "EMPRÉSTIMO FERNANDO", "DEVOLUÇÃO THIEMY", "DEVOLUÇÃO FERNANDO"], cor: "text-blue-600" },
  { label: "Estorno / Transferência", cats: ["ESTORNO"], cor: "text-indigo-600" },
];

export default function FluxoDeCaixaPage() {
  const [dados, setDados] = useState<DadosCaixa | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [bancos, setBancos] = useState(["C6 BANK", "Banco Itaú"]);
  const [ordensServico, setOrdensServico] = useState<OrdemServicoItem[]>([]);
  const [contasPagar, setContasPagar] = useState<ContaPagarItem[]>([]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => { if (d.bancos?.length) setBancos(d.bancos); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/ordens-servico")
      .then((r) => r.json())
      .then((d) => setOrdensServico(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/contas-a-pagar")
      .then((r) => r.json())
      .then((d) => setContasPagar(Array.isArray(d?.contas) ? d.contas : []))
      .catch(() => {});
  }, []);

  // Filtros
  const hoje = new Date();
  const [mesSel, setMesSel] = useState(hoje.getMonth()); // 0-based
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());
  const [bancoFiltro, setBancoFiltro] = useState("Todos");
  const [areaFiltro, setAreaFiltro] = useState("Todas");
  const [catFiltro, setCatFiltro] = useState("Todas");
  const [osFiltro, setOsFiltro] = useState("Todas");
  const [busca, setBusca] = useState("");
  const [ordemCampo, setOrdemCampo] = useState<"data" | "valor" | "categoria">("data");
  const [ordemDir, setOrdemDir] = useState<"asc" | "desc">("asc");

  // Modal novo lançamento
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [form, setForm] = useState({
    data: "", modalidade: "PIX", banco: "C6 BANK", valor: "",
    area: "PROJETOS", categoria: "RECEITA OPERACIONAL BRUTA", obs: "",
    ordemServicoId: "", contaPagarId: "",
  });
  const [salvando, setSalvando] = useState(false);

  // Comprovante upload
  const [comprovanteUploading, setComprovanteUploading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErro(null);
    fetch("/api/fluxo-caixa")
      .then((r) => {
        if (!r.ok) throw new Error(`Erro HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setDados(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erro ao carregar fluxo de caixa:", err);
        setErro(err.message || "Erro ao carregar dados");
        setDados(null);
        setLoading(false);
      });
  }, []);

  // Lançamentos do mês selecionado
  const lancamentosMes = useMemo(() => {
    if (!dados || !Array.isArray(dados.lancamentos)) return [];
    return dados.lancamentos.filter((l) => {
      if (!l || !l.data) return false;
      const d = new Date(l.data + "T12:00:00");
      return !isNaN(d.getTime()) && d.getMonth() === mesSel && d.getFullYear() === anoSel;
    });
  }, [dados, mesSel, anoSel]);

  // Saldo acumulado até início do mês
  const saldoAnteMes = useMemo(() => {
    if (!dados || !Array.isArray(dados.lancamentos)) return 0;
    const limite = new Date(anoSel, mesSel, 1);
    const saldoInicialDt = new Date((dados.saldoInicialData || "") + "T12:00:00");
    const hasValidDate = !isNaN(saldoInicialDt.getTime());
    let acc = typeof dados.saldoInicial === "number" ? dados.saldoInicial : 0;
    for (const l of dados.lancamentos) {
      if (!l || typeof l.valor !== "number") continue;
      const d = new Date((l.data || "") + "T12:00:00");
      if (isNaN(d.getTime())) continue;
      if (!hasValidDate || (d >= saldoInicialDt && d < limite)) acc += l.valor;
    }
    return acc;
  }, [dados, mesSel, anoSel]);

  // Aplicar filtros adicionais
  const lancamentosFiltrados = useMemo(() => {
    let lista = lancamentosMes;
    if (bancoFiltro !== "Todos") lista = lista.filter((l) => l.banco === bancoFiltro);
    if (areaFiltro !== "Todas") lista = lista.filter((l) => l.area === areaFiltro);
    if (catFiltro !== "Todas") lista = lista.filter((l) => l.categoria === catFiltro);
    if (osFiltro !== "Todas") lista = lista.filter((l) => l.ordemServicoId === osFiltro);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter((l) => (l.obs ?? "").toLowerCase().includes(q) || (l.categoria ?? "").toLowerCase().includes(q));
    }
    lista = [...lista].sort((a, b) => {
      let va: string | number = a[ordemCampo];
      let vb: string | number = b[ordemCampo];
      if (ordemCampo === "valor") { va = Math.abs(a.valor); vb = Math.abs(b.valor); }
      if (va < vb) return ordemDir === "asc" ? -1 : 1;
      if (va > vb) return ordemDir === "asc" ? 1 : -1;
      return 0;
    });
    return lista;
  }, [lancamentosMes, bancoFiltro, areaFiltro, catFiltro, osFiltro, busca, ordemCampo, ordemDir]);

  // KPIs do mês
  const kpis = useMemo(() => {
    const entradas = lancamentosMes.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0);
    const saidas = lancamentosMes.filter((l) => l.valor < 0).reduce((s, l) => s + l.valor, 0);
    const resultado = entradas + saidas;
    const saldoFinal = saldoAnteMes + resultado;
    return { entradas, saidas, resultado, saldoFinal };
  }, [lancamentosMes, saldoAnteMes]);

  // Saldo corrido por linha (filtered)
  const comSaldo = useMemo(() => {
    if (ordemCampo !== "data") return lancamentosFiltrados.map((l) => ({ ...l, saldoCorrido: null }));
    let acc = saldoAnteMes;
    // Precisamos calcular o saldo com base nos lançamentos DO MÊS (todos, não filtrados) até cada linha
    const porData = [...lancamentosMes].sort((a, b) => a.data.localeCompare(b.data));
    const saldoMap = new Map<string, number>();
    for (const l of porData) { acc += l.valor; saldoMap.set(l.id, acc); }
    return lancamentosFiltrados.map((l) => ({ ...l, saldoCorrido: saldoMap.get(l.id) ?? null }));
  }, [lancamentosFiltrados, lancamentosMes, saldoAnteMes, ordemCampo]);

  // DRE Summary do mês
  const dre = useMemo(() => {
    return GRUPOS_DRE.map((g) => {
      const total = lancamentosMes
        .filter((l) => g.cats.includes(l.categoria))
        .reduce((s, l) => s + l.valor, 0);
      return { ...g, total };
    });
  }, [lancamentosMes]);

  const osPorId = useMemo(() => {
    const map: Record<string, OrdemServicoItem> = {};
    for (const os of ordensServico) {
      map[os.id] = os;
    }
    return map;
  }, [ordensServico]);

  const contaPorId = useMemo(() => {
    const map: Record<string, ContaPagarItem> = {};
    for (const c of contasPagar) {
      map[c.id] = c;
    }
    return map;
  }, [contasPagar]);

  function toggleOrdem(campo: "data" | "valor" | "categoria") {
    if (ordemCampo === campo) setOrdemDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setOrdemCampo(campo); setOrdemDir("asc"); }
  }

  function abrirNovo() {
    setEditando(null);
    setForm({ data: new Date().toISOString().split("T")[0], modalidade: "PIX", banco: "C6 BANK", valor: "", area: "PROJETOS", categoria: "RECEITA OPERACIONAL BRUTA", obs: "", ordemServicoId: "", contaPagarId: "" });
    setModalAberto(true);
  }

  function abrirEditar(l: Lancamento) {
    setEditando(l);
    setForm({ data: l.data, modalidade: l.modalidade, banco: l.banco, valor: String(l.valor), area: l.area, categoria: l.categoria, obs: l.obs, ordemServicoId: l.ordemServicoId ?? "", contaPagarId: l.contaPagarId ?? "" });
    setModalAberto(true);
  }

  async function salvarLancamento() {
    if (!form.data || !form.valor || !form.obs.trim()) return;
    setSalvando(true);
    const payload = { ...form, valor: parseFloat(form.valor.replace(",", ".")) };
    try {
      if (editando) {
        await fetch(`/api/fluxo-caixa/${editando.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        setDados((prev) => prev ? { ...prev, lancamentos: prev.lancamentos.map((l) => l.id === editando.id ? { ...l, ...payload } : l) } : prev);
      } else {
        const res = await fetch("/api/fluxo-caixa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const novo = await res.json();
        setDados((prev) => prev ? { ...prev, lancamentos: [...prev.lancamentos, novo] } : prev);
      }
      setModalAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    await fetch(`/api/fluxo-caixa/${id}`, { method: "DELETE" });
    setDados((prev) => prev ? { ...prev, lancamentos: prev.lancamentos.filter((l) => l.id !== id) } : prev);
  }

  function navMes(dir: number) {
    let m = mesSel + dir;
    let a = anoSel;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMesSel(m); setAnoSel(a);
  }

  if (loading) return (
    <WorkspaceLayout>
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-[#fb4d06] border-t-transparent rounded-full animate-spin" />
      </div>
    </WorkspaceLayout>
  );

  if (erro) return (
    <WorkspaceLayout>
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Erro ao carregar dados</h2>
          <p className="text-gray-500 text-sm mb-4">{erro}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#fb4d06] text-white font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition text-sm"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    </WorkspaceLayout>
  );

  return (
    <WorkspaceLayout>
      <main className="px-6 py-6 max-w-7xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Fluxo de Caixa</h1>
            <p className="text-gray-500 text-sm mt-0.5">Controle de entradas e saídas — Omni Alt</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={abrirNovo} className="bg-[#fb4d06] text-white font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Novo Lançamento
            </button>
          </div>
        </div>

        {/* Navegação de mês */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navMes(-1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex items-center gap-1">
            {MESES.map((m, i) => (
              <button key={i} onClick={() => setMesSel(i)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${mesSel === i ? "bg-[#fb4d06] text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
            {[2026, 2027].map((a) => (
              <button key={a} onClick={() => setAnoSel(a)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${anoSel === a ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                {a}
              </button>
            ))}
          </div>
          <button onClick={() => navMes(1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Saldo Inicial do Mês", valor: saldoAnteMes, cor: "text-gray-700", bg: "bg-gray-50", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
            { label: "Entradas", valor: kpis.entradas, cor: "text-green-700", bg: "bg-green-50", icon: "M7 11l5-5m0 0l5 5m-5-5v12" },
            { label: "Saídas", valor: kpis.saidas, cor: "text-red-600", bg: "bg-red-50", icon: "M17 13l-5 5m0 0l-5-5m5 5V6" },
            { label: "Saldo Final do Mês", valor: kpis.saldoFinal, cor: kpis.saldoFinal >= 0 ? "text-[#fb4d06]" : "text-red-700", bg: kpis.saldoFinal >= 0 ? "bg-orange-50" : "bg-red-50", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
          ].map((k) => (
            <div key={k.label} className={`${k.bg} rounded-2xl p-4 border border-gray-100`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500">{k.label}</p>
                <div className="w-7 h-7 rounded-lg bg-white/70 flex items-center justify-center">
                  <svg className={`w-3.5 h-3.5 ${k.cor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={k.icon} />
                  </svg>
                </div>
              </div>
              <p className={`text-xl font-bold ${k.cor}`}>{fmt(k.valor)}</p>
            </div>
          ))}
        </div>

        {/* Saldo por Banco */}
        {(() => {
          const bancosAtivos = [...new Set(lancamentosMes.map((l) => l.banco).filter(Boolean))];
          if (bancosAtivos.length === 0) return null;
          return (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Saldo por Banco no Mês</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {bancosAtivos.map((banco) => {
                  const mov = lancamentosMes.filter((l) => l.banco === banco);
                  const entradas = mov.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0);
                  const saidas = mov.filter((l) => l.valor < 0).reduce((s, l) => s + l.valor, 0);
                  const cb = corBanco(banco);
                  return (
                    <div key={banco} className={`${cb.bg} rounded-xl p-3 border border-gray-100`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cb.bg} ${cb.cor}`}>{cb.abrev}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-gray-500">Entradas</span>
                          <span className="text-[10px] font-semibold text-green-700">{fmt(entradas)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-gray-500">Saídas</span>
                          <span className="text-[10px] font-semibold text-red-600">{fmt(saidas)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-gray-200/50 mt-0.5">
                          <span className="text-[10px] font-medium text-gray-600">Saldo</span>
                          <span className={`text-xs font-bold ${entradas + saidas >= 0 ? "text-green-700" : "text-red-600"}`}>
                            {fmt(entradas + saidas)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tabela principal */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              {/* Filtros */}
              <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-center">
                <input
                  placeholder="Buscar em observações..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 w-52"
                />
                <select value={bancoFiltro} onChange={(e) => setBancoFiltro(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                  <option>Todos</option>
                  {bancos.map((b) => <option key={b}>{b}</option>)}
                </select>
                <select value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                  <option>Todas</option>
                  {AREAS.map((a) => <option key={a}>{a}</option>)}
                </select>
                <select value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 flex-1 min-w-36">
                  <option value="Todas">Todas categorias</option>
                  {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                </select>
                <select value={osFiltro} onChange={(e) => setOsFiltro(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 min-w-28">
                  <option value="Todas">Todas OS</option>
                  {ordensServico.map((os) => (
                    <option key={os.id} value={os.id}>#{os.numero}</option>
                  ))}
                </select>
                <span className="text-xs text-gray-400 ml-auto">{lancamentosFiltrados.length} lançamentos</span>
              </div>

              {/* Tabela */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th onClick={() => toggleOrdem("data")} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700 select-none whitespace-nowrap">
                        Data {ordemCampo === "data" ? (ordemDir === "asc" ? "↑" : "↓") : ""}
                      </th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Modalidade</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Banco</th>
                      <th onClick={() => toggleOrdem("categoria")} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700 select-none">
                        Categoria {ordemCampo === "categoria" ? (ordemDir === "asc" ? "↑" : "↓") : ""}
                      </th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">OS</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Conta</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Observação</th>
                      <th onClick={() => toggleOrdem("valor")} className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700 select-none whitespace-nowrap">
                        Valor {ordemCampo === "valor" ? (ordemDir === "asc" ? "↑" : "↓") : ""}
                      </th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Saldo</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {comSaldo.length === 0 && (
                      <tr><td colSpan={10} className="text-center py-12 text-gray-400 text-sm">Nenhum lançamento encontrado para este período.</td></tr>
                    )}
                    {comSaldo.map((l) => (
                      <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50 group">
                        <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap font-medium">
                          {new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{l.modalidade}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${corBanco(l.banco).bg} ${corBanco(l.banco).cor}`}>
                            {corBanco(l.banco).abrev}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-medium ${corCategoria(l.categoria)}`}>{l.categoria}</span>
                          <span className={`ml-1.5 text-[9px] font-semibold px-1 py-0.5 rounded ${
                            l.area === "PROJETOS" ? "bg-orange-50 text-orange-600" :
                            l.area === "DIGITAL" ? "bg-purple-50 text-purple-600" :
                            l.area === "ESTORNO" ? "bg-blue-50 text-blue-600" :
                            "bg-gray-100 text-gray-500"
                          }`}>{l.area}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          {l.ordemServicoId && osPorId[l.ordemServicoId] ? (
                            <a href={`/ordens-servico/${l.ordemServicoId}`}
                              className="text-xs font-semibold text-[#fb4d06] hover:underline whitespace-nowrap">
                              #{osPorId[l.ordemServicoId].numero}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {l.contaPagarId && contaPorId[l.contaPagarId] ? (
                            <span className="text-xs text-gray-600 whitespace-nowrap" title={contaPorId[l.contaPagarId].fornecedor}>
                              {contaPorId[l.contaPagarId].fornecedor}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 max-w-xs">
                          <span className="line-clamp-1" title={l.obs}>{l.obs}</span>
                        </td>
                        <td className={`px-3 py-2.5 text-right font-semibold text-sm whitespace-nowrap ${l.valor >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {l.valor >= 0 ? "+" : ""}{fmt(l.valor)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 whitespace-nowrap">
                          {l.saldoCorrido !== null ? fmt(l.saldoCorrido) : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => abrirEditar(l)} className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            {/* Comprovante */}
                            <div className="flex items-center gap-0.5">
                              <label className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer ${l.comprovanteUrl ? "text-green-500 hover:bg-green-50" : "text-gray-300 hover:text-gray-500 hover:bg-gray-100"}`}
                                title={l.comprovanteUrl ? "Trocar comprovante" : "Upload comprovante"}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <input type="file" accept=".pdf,.png,.jpg,.jpeg"
                                  disabled={comprovanteUploading === l.id}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setComprovanteUploading(l.id);
                                    try {
                                      const fd = new FormData();
                                      fd.append("arquivo", file);
                                      const res = await fetch(`/api/fluxo-caixa/${l.id}/comprovante`, { method: "POST", body: fd });
                                      const d = res.ok ? await res.json() : null;
                                      if (d?.comprovanteUrl) {
                                        setDados((prev) => prev ? { ...prev, lancamentos: prev.lancamentos.map((x) => x.id === l.id ? { ...x, comprovanteUrl: d.comprovanteUrl } : x) } : prev);
                                      } else {
                                        const errText = await res.text().catch(() => "Erro desconhecido");
                                        console.error("Upload comprovante falhou:", res.status, errText);
                                        alert("Erro ao fazer upload do comprovante");
                                      }
                                    } catch (err) {
                                      console.error("Upload comprovante erro:", err);
                                      alert("Erro de rede ao enviar comprovante");
                                    } finally {
                                      setComprovanteUploading(null);
                                    }
                                  }} />
                              </label>
                              {l.comprovanteUrl && (
                                <a href={`/api/uploads/fluxo-caixa/${l.id}/${l.comprovanteUrl}`} target="_blank" rel="noopener noreferrer"
                                  className="w-6 h-6 rounded flex items-center justify-center text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                                  title="Abrir comprovante">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                              )}
                              {l.comprovanteUrl && (
                                <button type="button" onClick={async () => {
                                  if (!confirm("Remover comprovante?")) return;
                                  await fetch(`/api/fluxo-caixa/${l.id}/comprovante`, { method: "DELETE" });
                                  setDados((prev) => prev ? { ...prev, lancamentos: prev.lancamentos.map((x) => x.id === l.id ? { ...x, comprovanteUrl: undefined } : x) } : prev);
                                }} className="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50" title="Remover comprovante">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              )}
                            </div>
                            <button onClick={() => excluir(l.id)} className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {comSaldo.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={7} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total do período filtrado</td>
                        <td className={`px-3 py-2.5 text-right font-bold text-sm ${lancamentosFiltrados.reduce((s, l) => s + l.valor, 0) >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {fmt(lancamentosFiltrados.reduce((s, l) => s + l.valor, 0))}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          {/* DRE Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">DRE — {MESES[mesSel]}/{anoSel}</h3>
              <div className="flex flex-col gap-1">
                {dre.map((g) => (
                  g.total !== 0 && (
                    <div key={g.label} className="flex justify-between items-start py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-xs text-gray-600 flex-1 pr-2 leading-snug">{g.label}</span>
                      <span className={`text-xs font-semibold whitespace-nowrap ${g.total >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {g.total >= 0 ? "+" : ""}{fmt(g.total)}
                      </span>
                    </div>
                  )
                ))}
              </div>
              <div className="mt-3 pt-3 border-t-2 border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700">Resultado do Mês</span>
                  <span className={`text-sm font-bold ${kpis.resultado >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {kpis.resultado >= 0 ? "+" : ""}{fmt(kpis.resultado)}
                  </span>
                </div>
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700">Saldo Final</span>
                  <span className={`text-sm font-bold ${kpis.saldoFinal >= 0 ? "text-[#fb4d06]" : "text-red-700"}`}>
                    {fmt(kpis.saldoFinal)}
                  </span>
                </div>
              </div>

              {/* Distribuição por área */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Por Área</p>
                {AREAS.map((a) => {
                  const tot = lancamentosMes.filter((l) => l.area === a).reduce((s, l) => s + l.valor, 0);
                  if (tot === 0) return null;
                  return (
                    <div key={a} className="flex justify-between items-center py-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        a === "PROJETOS" ? "bg-orange-50 text-orange-600" :
                        a === "DIGITAL" ? "bg-purple-50 text-purple-600" :
                        a === "ESTORNO" ? "bg-blue-50 text-blue-600" :
                        "bg-gray-100 text-gray-500"
                      }`}>{a}</span>
                      <span className={`text-xs font-semibold ${tot >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(tot)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Novo / Editar Lançamento */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalAberto(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">{editando ? "Editar Lançamento" : "Novo Lançamento"}</h2>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
                  <input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Valor (use - para saída)</label>
                  <input type="text" placeholder="-1500.00" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Modalidade</label>
                  <select value={form.modalidade} onChange={(e) => setForm((f) => ({ ...f, modalidade: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                    {MODALIDADES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Banco</label>
                  <select value={form.banco} onChange={(e) => setForm((f) => ({ ...f, banco: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                    {bancos.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Área</label>
                  <select value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                    {AREAS.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Categoria DRE</label>
                  <select value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                    {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Observação / Descrição</label>
                <input type="text" placeholder="Ex: Fornecedor XYZ — Projeto Aramis" value={form.obs} onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Ordem de Serviço</label>
                <select value={form.ordemServicoId} onChange={(e) => setForm((f) => ({ ...f, ordemServicoId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                  <option value="">Nenhuma</option>
                  {ordensServico.map((os) => (
                    <option key={os.id} value={os.id}>#{os.numero} — {os.cliente}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Vincule este lançamento a uma Ordem de Serviço.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Conta a Pagar</label>
                <select value={form.contaPagarId} onChange={(e) => setForm((f) => ({ ...f, contaPagarId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                  <option value="">Nenhuma (lançamento avulso)</option>
                  {contasPagar
                    .filter((c) => c.status !== "pago" || c.id === form.contaPagarId)
                    .sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime())
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fornecedor} — {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.valor)} {c.dataVencimento ? `(Venc: ${c.dataVencimento})` : ""}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Selecione uma conta pendente para marcá-la como paga ao salvar.</p>
              </div>
            </div>
            <div className="px-6 pb-6 pt-2 flex gap-3">
              <button onClick={() => setModalAberto(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={salvarLancamento} disabled={salvando || !form.data || !form.valor || !form.obs.trim()}
                className="flex-[2] py-2.5 rounded-xl bg-[#fb4d06] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40">
                {salvando ? "Salvando..." : editando ? "Salvar Alterações" : "Adicionar Lançamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
}
