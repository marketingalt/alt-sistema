"use client";

import { useEffect, useState, useMemo } from "react";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";

interface Conta {
  id: string;
  dataVencimento: string;
  dataPagamento?: string;
  fornecedor: string;
  fornecedorId?: string;
  descricao: string;
  valor: number;
  modalidade: string;
  banco: string;
  area: string;
  categoria: string;
  obs?: string;
  status: "pendente" | "pago" | "cancelado";
  recorrente?: boolean;
  periodicidade?: string | null;
  fluxoCaixaId?: string;
  driveLink?: string;
  boletoUrl?: string;
  dadosBancarios?: {
    nome?: string;
    banco?: string;
    chavePix?: string;
    agencia?: string;
    conta?: string;
  };
  ordemServicoId?: string;
  createdAt: string;
}

interface OrdemServicoItem {
  id: string;
  numero: string;
  cliente: string;
  orcamentoId?: string;
}

interface FornecedorItem {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  dadosBancarios: string;
  status: string;
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
const COR_BANCO_PADRAO: Record<string, { cor: string; bg: string; abrev: string }> = {
  "C6 BANK": { cor: "text-yellow-700", bg: "bg-yellow-50", abrev: "C6" },
  "Banco Itaú": { cor: "text-blue-700", bg: "bg-blue-50", abrev: "Itaú" },
  "NUBANK": { cor: "text-purple-700", bg: "bg-purple-50", abrev: "Nubank" },
};
function corBanco(banco: string | null | undefined) {
  if (!banco) return { cor: "text-gray-400", bg: "bg-gray-50", abrev: "—" };
  return COR_BANCO_PADRAO[banco] || { cor: "text-gray-700", bg: "bg-gray-50", abrev: banco.substring(0, 6) };
}
const AREAS = ["PROJETOS", "DIGITAL", "MISTO", "ESTORNO"];
const PERIODICIDADES = ["mensal", "quinzenal", "semanal", "anual"];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type ImportPreview = {
  total: number; validas: number; erros: number;
  linhas: { linha: number; erros: string[]; mapeado: Record<string, string> | null }[];
  totalExibido: number; haMais: boolean;
} | null;

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return "R$ 0,00";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusEfetivo(conta: Conta): "pendente" | "vencido" | "pago" | "cancelado" {
  if (conta.status === "pago") return "pago";
  if (conta.status === "cancelado") return "cancelado";
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(conta.dataVencimento + "T12:00:00");
  if (venc < hoje) return "vencido";
  return "pendente";
}

const STATUS_CONFIG = {
  pendente: { label: "Pendente", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400" },
  vencido:  { label: "Vencido",  bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
  pago:     { label: "Pago",     bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
  cancelado:{ label: "Cancelado",bg: "bg-gray-50",   text: "text-gray-500",   dot: "bg-gray-400" },
};

function diasParaVencer(dataVenc: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataVenc + "T12:00:00");
  return Math.ceil((venc.getTime() - hoje.getTime()) / 86400000);
}

const FORM_VAZIO = {
  dataVencimento: "", fornecedor: "", fornecedorId: "", descricao: "", valor: "",
  modalidade: "PIX", banco: "C6 BANK", area: "MISTO",
  categoria: "DESPESAS ADM E GERAIS", obs: "",
  recorrente: false, periodicidade: "mensal",
  ordemServicoId: "",
  status: "pendente",
  dataPagamento: "",
};

export default function ContasAPagarPage() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [bancos, setBancos] = useState(["C6 BANK", "Banco Itaú"]);
  const [ordensServico, setOrdensServico] = useState<OrdemServicoItem[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorItem[]>([]);
  const [modalNovoFornecedor, setModalNovoFornecedor] = useState(false);
  const [fornecedorBusca, setFornecedorBusca] = useState("");
  const [salvandoFornecedor, setSalvandoFornecedor] = useState(false);
  const [formNovoFornecedor, setFormNovoFornecedor] = useState({
    razaoSocial: "", nomeFantasia: "", cnpj: "",
    dadosBancarios: "",
  });

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
    fetch("/api/fornecedores")
      .then((r) => r.json())
      .then((d) => setFornecedores(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);
  const hoje = new Date();
  const [mesSel, setMesSel] = useState(hoje.getMonth());
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [areaFiltro, setAreaFiltro] = useState("Todas");
  const [catFiltro, setCatFiltro] = useState("Todas");
  const [busca, setBusca] = useState("");

  // Modal editar/criar
  const [modalForm, setModalForm] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);
  const [form, setForm] = useState({ ...FORM_VAZIO });
  const [salvando, setSalvando] = useState(false);

  const [boletoUploading, setBoletoUploading] = useState(false);
  const [boletoUrl, setBoletoUrl] = useState("");

  // Modal pagar
  const [modalPagar, setModalPagar] = useState<Conta | null>(null);
  const [formPagar, setFormPagar] = useState({ dataPagamento: "", modalidade: "PIX", banco: "C6 BANK" });
  const [pagando, setPagando] = useState(false);

  // Importar planilha
  const [showModalImportar, setShowModalImportar] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview>(null);
  const [importando, setImportando] = useState(false);

  // Painel de detalhe
  const [detalhe, setDetalhe] = useState<Conta | null>(null);
  const [driveInput, setDriveInput] = useState("");
  const [salvandoLink, setSalvandoLink] = useState(false);
  const [dadosBancariosForm, setDadosBancariosForm] = useState({ nome: "", banco: "", chavePix: "", agencia: "", conta: "" });

  useEffect(() => {
    fetch("/api/contas-a-pagar")
      .then((r) => r.json())
      .then((d) => setContas(d.contas ?? []))
      .finally(() => setLoading(false));
  }, []);

  // Contas do mês selecionado
  const contasMes = useMemo(() => {
    return contas.filter((c) => {
      const ref = c.dataPagamento ?? c.dataVencimento;
      const d = new Date(ref + "T12:00:00");
      return d.getMonth() === mesSel && d.getFullYear() === anoSel;
    });
  }, [contas, mesSel, anoSel]);

  // KPIs
  const kpis = useMemo(() => {
    const todas = contasMes;
    const pendentes = todas.filter((c) => statusEfetivo(c) === "pendente");
    const vencidas = todas.filter((c) => statusEfetivo(c) === "vencido");
    const pagas = todas.filter((c) => c.status === "pago");
    const proximas7 = contas.filter((c) => {
      if (c.status !== "pendente") return false;
      const d = diasParaVencer(c.dataVencimento);
      return d >= 0 && d <= 7;
    });
    return {
      totalPendente: pendentes.reduce((s, c) => s + c.valor, 0),
      totalVencido: vencidas.reduce((s, c) => s + c.valor, 0),
      totalPago: pagas.reduce((s, c) => s + c.valor, 0),
      proximas7: proximas7.length,
      totalProximas7: proximas7.reduce((s, c) => s + c.valor, 0),
    };
  }, [contasMes, contas]);

  // Filtros aplicados
  const contasFiltradas = useMemo(() => {
    let lista = contasMes;
    if (statusFiltro !== "todos") lista = lista.filter((c) => statusEfetivo(c) === statusFiltro);
    if (areaFiltro !== "Todas") lista = lista.filter((c) => c.area === areaFiltro);
    if (catFiltro !== "Todas") lista = lista.filter((c) => c.categoria === catFiltro);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter((c) => c.fornecedor.toLowerCase().includes(q) || c.descricao.toLowerCase().includes(q) || (c.obs ?? "").toLowerCase().includes(q));
    }
    return lista.sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
  }, [contasMes, statusFiltro, areaFiltro, catFiltro, busca]);

  const osPorId = useMemo(() => {
    const map: Record<string, OrdemServicoItem> = {};
    for (const os of ordensServico) {
      map[os.id] = os;
    }
    return map;
  }, [ordensServico]);

  const fornecedoresFiltrados = useMemo(() => {
    if (!fornecedorBusca.trim()) return fornecedores.slice(0, 20);
    const q = fornecedorBusca.toLowerCase();
    return fornecedores.filter(
      (f) =>
        (f?.razaoSocial ?? "").toLowerCase().includes(q) ||
        (f?.nomeFantasia ?? "").toLowerCase().includes(q) ||
        (f?.cnpj ?? "").includes(q)
    ).slice(0, 20);
  }, [fornecedores, fornecedorBusca]);

  function navMes(dir: number) {
    let m = mesSel + dir; let a = anoSel;
    if (m < 0) { m = 11; a--; } if (m > 11) { m = 0; a++; }
    setMesSel(m); setAnoSel(a);
  }

  function abrirNovo() {
    setEditando(null);
    setForm({ ...FORM_VAZIO, dataVencimento: new Date(anoSel, mesSel, 15).toISOString().split("T")[0] });
    setBoletoUrl("");
    setModalForm(true);
  }

  function abrirEditar(c: Conta) {
    setEditando(c);
    setForm({
      dataVencimento: c.dataVencimento, fornecedor: c.fornecedor, fornecedorId: c.fornecedorId ?? "", descricao: c.descricao,
      valor: String(c.valor), modalidade: c.modalidade, banco: c.banco, area: c.area,
      categoria: c.categoria, obs: c.obs ?? "",
      recorrente: c.recorrente ?? false, periodicidade: c.periodicidade ?? "mensal",
      ordemServicoId: c.ordemServicoId ?? "",
      status: c.status,
      dataPagamento: c.dataPagamento ?? "",
    });
    setBoletoUrl(c.boletoUrl ?? "");
    setModalForm(true);
  }

  function abrirPagar(c: Conta) {
    setModalPagar(c);
    setFormPagar({
      dataPagamento: new Date().toISOString().split("T")[0],
      modalidade: c.modalidade,
      banco: c.banco,
    });
  }

  async function salvarConta() {
    if (!form.dataVencimento || !form.fornecedor.trim() || !form.descricao.trim()) return;
    setSalvando(true);
    const payload = { ...form, valor: parseFloat(String(form.valor).replace(",", ".")) || 0, boletoUrl: boletoUrl || undefined };
    try {
      if (editando) {
        const res = await fetch(`/api/contas-a-pagar/${editando.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json();
        setContas((prev) => prev.map((c) =>
          c.id === editando.id
            ? { ...c, ...payload, ...(data.fluxoCaixaId ? { fluxoCaixaId: data.fluxoCaixaId } : {}) } as Conta
            : c
        ));
      } else {
        const res = await fetch("/api/contas-a-pagar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const nova = await res.json();
        setContas((prev) => [...prev, nova]);
      }
      setModalForm(false);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarPagamento() {
    if (!modalPagar || !formPagar.dataPagamento) return;
    setPagando(true);
    try {
      const res = await fetch(`/api/contas-a-pagar/${modalPagar.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagar: true, ...formPagar }),
      });
      const { fluxoCaixaId } = await res.json();
      setContas((prev) => prev.map((c) =>
        c.id === modalPagar.id
          ? { ...c, status: "pago", dataPagamento: formPagar.dataPagamento, fluxoCaixaId }
          : c
      ));
      setModalPagar(null);
    } finally {
      setPagando(false);
    }
  }

  function abrirDetalhe(c: Conta) {
    setDetalhe(c);
    setDriveInput(c.driveLink ?? "");
    setFormPagar({
      dataPagamento: new Date().toISOString().split("T")[0],
      modalidade: c.modalidade,
      banco: c.banco,
    });
    setDadosBancariosForm({
      nome: c.dadosBancarios?.nome ?? "",
      banco: c.dadosBancarios?.banco ?? "",
      chavePix: c.dadosBancarios?.chavePix ?? "",
      agencia: c.dadosBancarios?.agencia ?? "",
      conta: c.dadosBancarios?.conta ?? "",
    });
  }

  async function confirmarPagamentoDrawer() {
    if (!detalhe || !formPagar.dataPagamento) return;
    setPagando(true);
    const dadosBancarios =
      formPagar.modalidade === "PIX"
        ? { nome: dadosBancariosForm.nome, banco: dadosBancariosForm.banco, chavePix: dadosBancariosForm.chavePix }
        : formPagar.modalidade === "TED"
        ? { nome: dadosBancariosForm.nome, banco: dadosBancariosForm.banco, agencia: dadosBancariosForm.agencia, conta: dadosBancariosForm.conta }
        : undefined;
    try {
      const res = await fetch(`/api/contas-a-pagar/${detalhe.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagar: true, ...formPagar, dadosBancarios }),
      });
      const { fluxoCaixaId } = await res.json();
      const atualizada: Conta = {
        ...detalhe,
        status: "pago",
        dataPagamento: formPagar.dataPagamento,
        modalidade: formPagar.modalidade,
        banco: formPagar.banco,
        fluxoCaixaId,
        dadosBancarios,
      };
      setContas((prev) => prev.map((c) => (c.id === detalhe.id ? atualizada : c)));
      setDetalhe(atualizada);
    } finally {
      setPagando(false);
    }
  }

  async function salvarDadosBancarios() {
    if (!detalhe) return;
    const dadosBancarios =
      detalhe.modalidade === "PIX"
        ? { nome: dadosBancariosForm.nome, banco: dadosBancariosForm.banco, chavePix: dadosBancariosForm.chavePix }
        : { nome: dadosBancariosForm.nome, banco: dadosBancariosForm.banco, agencia: dadosBancariosForm.agencia, conta: dadosBancariosForm.conta };
    await fetch(`/api/contas-a-pagar/${detalhe.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dadosBancarios }),
    });
    const atualizada = { ...detalhe, dadosBancarios };
    setContas((prev) => prev.map((c) => (c.id === detalhe.id ? atualizada : c)));
    setDetalhe(atualizada);
  }

  async function salvarDriveLink() {
    if (!detalhe) return;
    setSalvandoLink(true);
    try {
      await fetch(`/api/contas-a-pagar/${detalhe.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveLink: driveInput.trim() }),
      });
      const atualizada = { ...detalhe, driveLink: driveInput.trim() };
      setContas((prev) => prev.map((c) => (c.id === detalhe.id ? atualizada : c)));
      setDetalhe(atualizada);
    } finally {
      setSalvandoLink(false);
    }
  }

  async function duplicar() {
    if (!editando) return;
    setSalvando(true);
    const payload = { ...form, valor: parseFloat(String(form.valor).replace(",", ".")) || 0 };
    try {
      const res = await fetch("/api/contas-a-pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const nova = await res.json();
      setContas((prev) => [...prev, nova]);
      setModalForm(false);
    } finally {
      setSalvando(false);
    }
  }

  async function cancelar(id: string) {
    if (!confirm("Cancelar esta conta?")) return;
    await fetch(`/api/contas-a-pagar/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelado" }) });
    setContas((prev) => prev.map((c) => c.id === id ? { ...c, status: "cancelado" } : c));
  }

  async function excluir(id: string) {
    if (!confirm("Excluir definitivamente esta conta?")) return;
    await fetch(`/api/contas-a-pagar/${id}`, { method: "DELETE" });
    setContas((prev) => prev.filter((c) => c.id !== id));
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
      <main className="px-6 py-6 max-w-7xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Contas a Pagar</h1>
            <p className="text-gray-500 text-sm mt-0.5">Gerencie obrigações e pagamentos. Ao confirmar o pagamento, o lançamento vai automaticamente para o Fluxo de Caixa.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={abrirNovo} className="bg-[#fb4d06] text-white font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Nova Conta
            </button>
            <button onClick={() => setShowModalImportar(true)} className="border border-gray-200 text-gray-600 font-semibold py-2 px-5 rounded-xl hover:bg-gray-50 transition flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Importar Planilha
            </button>
          </div>
        </div>

        {/* Navegação de mês */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button onClick={() => navMes(-1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex items-center gap-1">
            {MESES.map((m, i) => (
              <button key={i} onClick={() => setMesSel(i)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${mesSel === i ? "bg-[#fb4d06] text-white" : "text-gray-500 hover:bg-gray-100"}`}>{m}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
            {[2026, 2027].map((a) => (
              <button key={a} onClick={() => setAnoSel(a)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${anoSel === a ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"}`}>{a}</button>
            ))}
          </div>
          <button onClick={() => navMes(1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-100">
            <p className="text-xs font-medium text-yellow-700 mb-1">A Pagar no Mês</p>
            <p className="text-xl font-bold text-yellow-800">{fmt(kpis.totalPendente)}</p>
            <p className="text-xs text-yellow-600 mt-0.5">{contasMes.filter((c) => statusEfetivo(c) === "pendente").length} conta(s)</p>
          </div>
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <p className="text-xs font-medium text-red-700 mb-1">Vencidas</p>
            <p className="text-xl font-bold text-red-700">{fmt(kpis.totalVencido)}</p>
            <p className="text-xs text-red-500 mt-0.5">{contasMes.filter((c) => statusEfetivo(c) === "vencido").length} conta(s) em atraso</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
            <p className="text-xs font-medium text-green-700 mb-1">Pago no Mês</p>
            <p className="text-xl font-bold text-green-700">{fmt(kpis.totalPago)}</p>
            <p className="text-xs text-green-600 mt-0.5">{contasMes.filter((c) => c.status === "pago").length} conta(s) pagas</p>
          </div>
          <div className={`rounded-2xl p-4 border ${kpis.proximas7 > 0 ? "bg-orange-50 border-orange-100" : "bg-gray-50 border-gray-100"}`}>
            <p className={`text-xs font-medium mb-1 ${kpis.proximas7 > 0 ? "text-orange-700" : "text-gray-500"}`}>Vencem em 7 dias</p>
            <p className={`text-xl font-bold ${kpis.proximas7 > 0 ? "text-orange-700" : "text-gray-600"}`}>{fmt(kpis.totalProximas7)}</p>
            <p className={`text-xs mt-0.5 ${kpis.proximas7 > 0 ? "text-orange-500" : "text-gray-400"}`}>{kpis.proximas7} conta(s)</p>
          </div>
        </div>

        {/* Alerta vencidos */}
        {contasMes.some((c) => statusEfetivo(c) === "vencido") && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-red-700 font-medium">
              {contasMes.filter((c) => statusEfetivo(c) === "vencido").length} conta(s) vencidas aguardando pagamento.
            </p>
          </div>
        )}

        {/* Tabela */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          {/* Filtros */}
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-center">
            <input placeholder="Buscar fornecedor ou descrição..."
              value={busca} onChange={(e) => setBusca(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 w-56" />
            <div className="flex gap-1">
              {(["todos", "pendente", "vencido", "pago", "cancelado"] as const).map((s) => (
                <button key={s} onClick={() => setStatusFiltro(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize ${
                    statusFiltro === s ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}>
                  {s === "todos" ? "Todos" : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? s}
                </button>
              ))}
            </div>
            <select value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
              <option>Todas</option>
              {AREAS.map((a) => <option key={a}>{a}</option>)}
            </select>
            <select value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 flex-1 min-w-40">
              <option value="Todas">Todas categorias</option>
              {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <span className="text-xs text-gray-400 ml-auto">{contasFiltradas.length} conta(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Vencimento</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Fornecedor / Descrição</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Categoria</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">OS</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Banco</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500">Valor</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contasFiltradas.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">Nenhuma conta encontrada para este período.</td></tr>
                )}
                {contasFiltradas.map((c) => {
                  const st = statusEfetivo(c);
                  const cfg = STATUS_CONFIG[st];
                  const dias = diasParaVencer(c.dataVencimento);
                  return (
                    <tr key={c.id} onClick={() => abrirDetalhe(c)} className={`border-b border-gray-50 group hover:bg-gray-50/50 cursor-pointer ${st === "vencido" ? "bg-red-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <p className={`text-xs font-bold ${st === "vencido" ? "text-red-600" : "text-gray-700"}`}>
                          {new Date(c.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                        </p>
                        {st === "pendente" && dias <= 7 && dias >= 0 && (
                          <p className="text-[10px] text-orange-500 font-semibold mt-0.5">
                            {dias === 0 ? "Vence hoje!" : `${dias}d`}
                          </p>
                        )}
                        {st === "vencido" && (
                          <p className="text-[10px] text-red-500 font-semibold mt-0.5">{Math.abs(dias)}d atraso</p>
                        )}
                        {c.recorrente && (
                          <span className="text-[9px] font-semibold text-indigo-500 bg-indigo-50 px-1 py-0.5 rounded mt-0.5 inline-block">
                            ↻ {c.periodicidade}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-semibold text-gray-800">{c.fornecedor}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{c.descricao}</p>
                        {c.obs && <p className="text-[10px] text-gray-400 mt-0.5 italic">{c.obs}</p>}
                        {c.status === "pago" && c.dataPagamento && (
                          <p className="text-[10px] text-green-600 mt-0.5 font-medium">
                            ✓ Pago em {new Date(c.dataPagamento + "T12:00:00").toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xs text-gray-600 font-medium">{c.categoria}</p>
                        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded mt-0.5 inline-block ${
                          c.area === "PROJETOS" ? "bg-orange-50 text-orange-600" :
                          c.area === "DIGITAL" ? "bg-purple-50 text-purple-600" :
                          "bg-gray-100 text-gray-500"
                        }`}>{c.area}</span>
                      </td>
                      <td className="px-3 py-3">
                        {c.ordemServicoId && osPorId[c.ordemServicoId] ? (
                          <a href={`/ordens-servico/${c.ordemServicoId}`}
                            className="text-xs font-semibold text-[#fb4d06] hover:underline whitespace-nowrap">
                            #{osPorId[c.ordemServicoId].numero}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit ${corBanco(c.banco).bg} ${corBanco(c.banco).cor}`}>
                            {corBanco(c.banco).abrev}
                          </span>
                          <span className="text-[10px] text-gray-400">{c.modalidade}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <p className={`text-sm font-bold ${c.valor === 0 ? "text-gray-400" : "text-red-600"}`}>
                          {c.valor === 0 ? "A confirmar" : fmt(c.valor)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* Botão Pagar — destaque quando pendente/vencido */}
                          {(st === "pendente" || st === "vencido") && (
                            <button onClick={() => abrirPagar(c)}
                              title="Marcar como pago"
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                st === "vencido"
                                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                                  : "bg-green-100 text-green-700 hover:bg-green-200"
                              }`}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              Pagar
                            </button>
                          )}
                          {c.status === "pago" && c.fluxoCaixaId && (
                            <span className="text-[10px] text-green-600 bg-green-50 px-2 py-1 rounded-lg font-semibold">✓ No Fluxo</span>
                          )}
                          {/* Editar */}
                          <button onClick={() => abrirEditar(c)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {/* Cancelar / Excluir */}
                          {c.status !== "pago" && (
                            <button onClick={() => cancelar(c.id)}
                              title="Cancelar conta"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-orange-500 hover:bg-orange-50 opacity-0 group-hover:opacity-100 transition">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          )}
                          <button onClick={() => excluir(c.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {contasFiltradas.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={5} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total do período</td>
                    <td className="px-3 py-2.5 text-right font-bold text-sm text-red-600">
                      {fmt(contasFiltradas.filter((c) => c.status !== "cancelado").reduce((s, c) => s + c.valor, 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </main>

      {/* ── Modal: Nova / Editar Conta ── */}
      {modalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setModalForm(false); setBoletoUrl(""); }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-800">{editando ? "Editar Conta" : "Nova Conta a Pagar"}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Preencha os dados da obrigação. Ao pagar, vai direto para o Fluxo de Caixa.</p>
              </div>
              <button onClick={() => { setModalForm(false); setBoletoUrl(""); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-3">
              {/* Fornecedor */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fornecedor / Beneficiário <span className="text-red-400">*</span></label>
                {form.fornecedorId ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 border border-green-200 bg-green-50 rounded-lg px-3 py-2 text-sm text-gray-800">
                      <span className="font-medium">{form.fornecedor}</span>
                      {(() => {
                        const f = fornecedores.find((x) => x.id === form.fornecedorId);
                        return f?.cnpj ? <span className="text-gray-400 ml-2 text-xs">{f.cnpj}</span> : null;
                      })()}
                    </div>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, fornecedorId: "", fornecedor: "" }))}
                      className="text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap">
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input value={fornecedorBusca} onChange={(e) => { setFornecedorBusca(e.target.value); setForm((f) => ({ ...f, fornecedor: e.target.value })); }}
                      placeholder="Digite para buscar fornecedor cadastrado..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                    {fornecedorBusca.trim() && fornecedoresFiltrados.length > 0 && (
                      <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                        {fornecedoresFiltrados.map((f) => (
                          <button key={f.id} type="button"
                            onClick={() => {
                              setForm((prev) => ({ ...prev, fornecedorId: f.id, fornecedor: f.razaoSocial || f.nomeFantasia }));
                              setFornecedorBusca("");
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 border-b border-gray-50 last:border-0">
                            <span className="font-medium text-gray-800">{f.razaoSocial || f.nomeFantasia}</span>
                            {f.nomeFantasia && f.nomeFantasia !== f.razaoSocial && (
                              <span className="text-gray-400 ml-1">({f.nomeFantasia})</span>
                            )}
                            <span className="text-gray-400 text-xs ml-2">{f.cnpj}</span>
                            {f.dadosBancarios && (
                              <span className="block text-[10px] text-gray-400 mt-0.5 truncate">{f.dadosBancarios}</span>
                            )}
                          </button>
                        ))}
                        <button type="button" onClick={() => setModalNovoFornecedor(true)}
                          className="w-full text-left px-3 py-2.5 text-xs font-semibold text-[#fb4d06] hover:bg-orange-50 border-t border-gray-100">
                          + Cadastrar novo fornecedor
                        </button>
                      </div>
                    )}
                    {fornecedorBusca.trim() && fornecedoresFiltrados.length === 0 && (
                      <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
                        <p className="text-xs text-gray-400 mb-2">Nenhum fornecedor encontrado.</p>
                        <button type="button" onClick={() => setModalNovoFornecedor(true)}
                          className="text-xs font-semibold text-[#fb4d06] hover:underline">
                          + Cadastrar novo fornecedor
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {form.fornecedorId && fornecedores.find((f) => f.id === form.fornecedorId)?.dadosBancarios && (
                  <p className="text-[10px] text-gray-500 mt-1 bg-gray-50 rounded px-2 py-1 border border-gray-100">
                    <span className="font-medium">Dados bancários:</span> {fornecedores.find((f) => f.id === form.fornecedorId)?.dadosBancarios}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Descrição <span className="text-red-400">*</span></label>
                <input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Salário mensal, Aluguel mai/26..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
              </div>

              {/* Data + Valor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Data de Vencimento <span className="text-red-400">*</span></label>
                  <input type="date" value={form.dataVencimento} onChange={(e) => setForm((f) => ({ ...f, dataVencimento: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Valor (R$)</label>
                  <input type="text" placeholder="0,00 (deixe 0 se indefinido)"
                    value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                </div>
              </div>

              {/* Modalidade + Banco */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Modalidade de Pagamento</label>
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

              {/* Área + Categoria DRE */}
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

              {/* Obs */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Observação</label>
                <input value={form.obs} onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))}
                  placeholder="Informação adicional (opcional)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
              </div>

              {/* Boleto */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Boleto (PDF ou imagem)</label>
                <div className="flex items-center gap-2">
                  <label className={`flex-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer hover:border-[#fb4d06] transition ${boletoUploading ? "opacity-50 pointer-events-none" : ""}`}>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-gray-500 text-xs">{boletoUploading ? "Enviando..." : boletoUrl ? "Trocar arquivo" : "Selecionar arquivo"}</span>
                    {editando ? (
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
                        disabled={boletoUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setBoletoUploading(true);
                          try {
                            const fd = new FormData();
                            fd.append("arquivo", file);
                            const res = await fetch(`/api/contas-a-pagar/${editando.id}/boleto`, { method: "POST", body: fd });
                            if (res.ok) {
                              const d = await res.json();
                              setBoletoUrl(d.boletoUrl);
                              setContas((prev) => prev.map((c) => c.id === editando.id ? { ...c, boletoUrl: d.boletoUrl } : c));
                            }
                          } finally {
                            setBoletoUploading(false);
                          }
                        }} />
                    ) : (
                      <span className="text-xs text-gray-400 ml-1">Disponível após salvar</span>
                    )}
                  </label>
                  {boletoUrl && (
                    <button type="button" onClick={() => {
                      setBoletoUrl("");
                      if (editando) {
                        fetch(`/api/contas-a-pagar/${editando.id}/boleto`, { method: "DELETE" });
                        setContas((prev) => prev.map((c) => c.id === editando.id ? { ...c, boletoUrl: undefined } : c));
                      }
                    }} className="text-xs text-red-500 hover:text-red-700 font-medium">Remover</button>
                  )}
                </div>
                {boletoUrl && (() => {
                  const contaId = editando?.id;
                  const boletoUrlFull = contaId ? `/api/uploads/contas-a-pagar/${contaId}/${boletoUrl}` : null;
                  if (!boletoUrlFull) return null;
                  return (
                    <a href={boletoUrlFull} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#fb4d06] hover:underline mt-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Ver boleto anexado
                  </a>
                  );
                })()}
                <p className="text-[10px] text-gray-400 mt-1">Anexe o boleto em PDF ou imagem para consulta futura.</p>
              </div>

              {/* Ordem de Serviço */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Ordem de Serviço</label>
                <select value={form.ordemServicoId} onChange={(e) => setForm((f) => ({ ...f, ordemServicoId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                  <option value="">Nenhuma</option>
                  {ordensServico.map((os) => (
                    <option key={os.id} value={os.id}>#{os.numero} — {os.cliente}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Vincule esta conta a uma Ordem de Serviço para rastrear as saídas do projeto.</p>
              </div>

              {/* Status (só na edição) */}
              {editando && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <label className="block text-xs font-medium text-gray-500 mb-2">Status do Pagamento</label>
                  <div className="flex gap-2">
                    {(["pendente", "pago", "cancelado"] as const).map((s) => (
                      <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, status: s }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition capitalize ${
                          form.status === s
                            ? s === "pago" ? "border-green-500 bg-green-50 text-green-700"
                              : s === "cancelado" ? "border-gray-400 bg-gray-100 text-gray-600"
                              : "border-yellow-400 bg-yellow-50 text-yellow-700"
                            : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}>
                        {s === "pendente" ? "Pendente" : s === "pago" ? "✓ Pago" : "Cancelado"}
                      </button>
                    ))}
                  </div>
                  {form.status === "pago" && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Data do Pagamento</label>
                      <input type="date" value={form.dataPagamento} onChange={(e) => setForm((f) => ({ ...f, dataPagamento: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                      <p className="text-[10px] text-gray-400 mt-1">Ao salvar como "Pago", será criado um lançamento no Fluxo de Caixa automaticamente.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Recorrência */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div onClick={() => setForm((f) => ({ ...f, recorrente: !f.recorrente }))}
                    className={`w-9 h-5 rounded-full relative transition-colors ${form.recorrente ? "bg-[#fb4d06]" : "bg-gray-300"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.recorrente ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Conta recorrente</span>
                </label>
                {form.recorrente && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Periodicidade</label>
                    <div className="flex gap-2">
                      {PERIODICIDADES.map((p) => (
                        <button key={p} type="button" onClick={() => setForm((f) => ({ ...f, periodicidade: p }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition capitalize ${
                            form.periodicidade === p ? "border-[#fb4d06] bg-[#fb4d06]/5 text-[#fb4d06]" : "border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}>{p}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6 pt-3 border-t border-gray-100 shrink-0 flex gap-3">
              <button onClick={() => { setModalForm(false); setBoletoUrl(""); }} className="py-2.5 px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              {editando && (
                <button onClick={duplicar} disabled={salvando}
                  title="Cria uma cópia desta conta como nova entrada pendente"
                  className="py-2.5 px-4 rounded-xl border border-[#fb4d06] text-[#fb4d06] text-sm font-semibold hover:bg-[#fb4d06]/5 disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Duplicar
                </button>
              )}
              <button onClick={salvarConta} disabled={salvando || !form.dataVencimento || !form.fornecedor.trim() || !form.descricao.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#fb4d06] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40">
                {salvando ? "Salvando..." : editando ? "Salvar Alterações" : "Adicionar Conta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drawer: Detalhe da Conta ── */}
      {detalhe && (() => {
        const st = statusEfetivo(detalhe);
        const cfg = STATUS_CONFIG[st];
        const dias = diasParaVencer(detalhe.dataVencimento);
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setDetalhe(null)} />
            <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-3 shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    {detalhe.recorrente && (
                      <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">↻ {detalhe.periodicidade}</span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-gray-900 truncate">{detalhe.fornecedor}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{detalhe.descricao}</p>
                </div>
                <button onClick={() => setDetalhe(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Ações rápidas */}
              <div className="px-6 py-3 border-b border-gray-100 flex gap-2 shrink-0">
                <button onClick={() => { setDetalhe(null); abrirEditar(detalhe); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Editar
                </button>
                <button onClick={async () => {
                    const payload = {
                      fornecedor: detalhe.fornecedor, descricao: detalhe.descricao,
                      dataVencimento: detalhe.dataVencimento, valor: detalhe.valor,
                      modalidade: detalhe.modalidade, banco: detalhe.banco,
                      area: detalhe.area, categoria: detalhe.categoria,
                      obs: detalhe.obs, recorrente: detalhe.recorrente,
                      periodicidade: detalhe.periodicidade,
                      ordemServicoId: detalhe.ordemServicoId || "",
                    };
                    const res = await fetch("/api/contas-a-pagar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                    const nova = await res.json();
                    setContas((prev) => [...prev, nova]);
                    setDetalhe(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#fb4d06] bg-[#fb4d06]/8 hover:bg-[#fb4d06]/15 transition">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Duplicar
                </button>
              </div>

              {/* Conteúdo rolável */}
              <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
                {/* Valor destacado */}
                <div className="bg-gray-50 rounded-2xl p-5 text-center border border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-1">Valor</p>
                  <p className={`text-3xl font-bold ${detalhe.valor === 0 ? "text-gray-400" : "text-red-600"}`}>
                    {detalhe.valor === 0 ? "A confirmar" : fmt(detalhe.valor)}
                  </p>
                  {st === "vencido" && (
                    <p className="text-xs text-red-500 font-semibold mt-1">{Math.abs(dias)} dia(s) em atraso</p>
                  )}
                  {st === "pendente" && dias >= 0 && dias <= 7 && (
                    <p className="text-xs text-orange-500 font-semibold mt-1">{dias === 0 ? "Vence hoje!" : `Vence em ${dias} dia(s)`}</p>
                  )}
                </div>

                {/* ── Seção de Pagamento ── */}
                {st === "pago" ? (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <p className="text-sm font-bold text-green-800">Pagamento Confirmado</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] font-medium text-green-600 uppercase mb-0.5">Data do Pagamento</p>
                        <p className="text-sm font-semibold text-green-800">
                          {detalhe.dataPagamento ? new Date(detalhe.dataPagamento + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-green-600 uppercase mb-0.5">Modalidade</p>
                        <p className="text-sm font-semibold text-green-800">{detalhe.modalidade}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-green-600 uppercase mb-0.5">Banco</p>
                        <p className="text-sm font-semibold text-green-800">{detalhe.banco}</p>
                      </div>
                      {detalhe.fluxoCaixaId && (
                        <div>
                          <p className="text-[10px] font-medium text-green-600 uppercase mb-0.5">ID Fluxo de Caixa</p>
                          <p className="text-xs font-mono text-green-700 truncate">{detalhe.fluxoCaixaId}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : st !== "cancelado" ? (
                  <div className={`rounded-2xl border p-4 ${st === "vencido" ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <svg className={`w-4 h-4 shrink-0 ${st === "vencido" ? "text-red-500" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className={`text-sm font-bold ${st === "vencido" ? "text-red-800" : "text-gray-700"}`}>Registrar Pagamento</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Data do Pagamento</label>
                        <input type="date" value={formPagar.dataPagamento}
                          onChange={(e) => setFormPagar((f) => ({ ...f, dataPagamento: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Modalidade</label>
                          <select value={formPagar.modalidade}
                            onChange={(e) => setFormPagar((f) => ({ ...f, modalidade: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                            {MODALIDADES.map((m) => <option key={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Banco</label>
                          <select value={formPagar.banco}
                            onChange={(e) => setFormPagar((f) => ({ ...f, banco: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                            {bancos.map((b) => <option key={b}>{b}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="bg-white/70 rounded-lg px-3 py-2 border border-gray-200">
                        <p className="text-[10px] text-gray-500">
                          Lançará <strong className="text-gray-700">{fmt(detalhe.valor)}</strong> no Fluxo de Caixa como <strong className="text-gray-700">{detalhe.categoria}</strong> — <strong className="text-gray-700">{detalhe.area}</strong>
                        </p>
                      </div>
                      <button onClick={confirmarPagamentoDrawer} disabled={pagando || !formPagar.dataPagamento}
                        className={`w-full py-2.5 rounded-xl text-white text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-40 ${st === "vencido" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}>
                        {pagando
                          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Registrando...</>
                          : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> Confirmar Pagamento</>
                        }
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* ── Dados de Pagamento (PIX / TED) ── */}
                {(formPagar.modalidade === "PIX" || formPagar.modalidade === "TED") && (
                  <div className="border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Dados de Pagamento — {formPagar.modalidade}
                      </p>
                    </div>
                    <div className="px-4 py-4 flex flex-col gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Nome completo</label>
                        <input value={dadosBancariosForm.nome}
                          onChange={(e) => setDadosBancariosForm((f) => ({ ...f, nome: e.target.value }))}
                          placeholder="Nome do favorecido"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Banco</label>
                        <input value={dadosBancariosForm.banco}
                          onChange={(e) => setDadosBancariosForm((f) => ({ ...f, banco: e.target.value }))}
                          placeholder={formPagar.modalidade === "PIX" ? "Ex: Nubank, C6 Bank, Itaú..." : "Ex: Itaú, Bradesco, Santander..."}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                      </div>
                      {formPagar.modalidade === "PIX" ? (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Chave PIX</label>
                          <input value={dadosBancariosForm.chavePix}
                            onChange={(e) => setDadosBancariosForm((f) => ({ ...f, chavePix: e.target.value }))}
                            placeholder="CPF, e-mail, telefone ou chave aleatória"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Agência</label>
                            <input value={dadosBancariosForm.agencia}
                              onChange={(e) => setDadosBancariosForm((f) => ({ ...f, agencia: e.target.value }))}
                              placeholder="0000"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Conta</label>
                            <input value={dadosBancariosForm.conta}
                              onChange={(e) => setDadosBancariosForm((f) => ({ ...f, conta: e.target.value }))}
                              placeholder="00000-0"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                          </div>
                        </div>
                      )}
                      <button onClick={salvarDadosBancarios}
                        className="w-full py-2 rounded-xl bg-gray-800 text-white text-xs font-semibold hover:bg-gray-700 transition">
                        Salvar dados de pagamento
                      </button>
                    </div>
                  </div>
                )}

                {/* Grid de informações */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Detalhes</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Vencimento</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {new Date(detalhe.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Modalidade</p>
                      <p className="text-sm font-semibold text-gray-800">{detalhe.modalidade}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Banco</p>
                      <p className="text-sm font-semibold text-gray-800">{detalhe.banco}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Área</p>
                      <p className="text-sm font-semibold text-gray-800">{detalhe.area}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Ordem de Serviço</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {detalhe.ordemServicoId && osPorId[detalhe.ordemServicoId]
                          ? `#${osPorId[detalhe.ordemServicoId].numero}`
                          : "—"}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Criado em</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {new Date(detalhe.createdAt + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Categoria */}
                <div>
                  <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Categoria DRE</p>
                  <p className="text-sm font-semibold text-gray-700 bg-gray-50 rounded-xl px-3 py-2.5">{detalhe.categoria}</p>
                </div>

                {/* Obs */}
                {detalhe.obs && (
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Observação</p>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5 italic">{detalhe.obs}</p>
                  </div>
                )}

                {/* Boleto */}
                {detalhe.boletoUrl && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Boleto</p>
                    </div>
                    <a href={`/api/uploads/contas-a-pagar/${detalhe.id}/${detalhe.boletoUrl}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl p-3 hover:bg-orange-100 transition group">
                      <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-orange-700 group-hover:underline">Abrir boleto anexado</p>
                        <p className="text-[10px] text-orange-500">PDF ou imagem do boleto bancário</p>
                      </div>
                    </a>
                  </div>
                )}

                {/* Documentos / Google Drive */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documentos</p>
                  </div>

                  {detalhe.driveLink ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-4 h-4 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6.28 3l5.72 9.9L17.72 3H6.28zm-1.54.83L1.5 10.5h8.1L6.74 3.83zm13 0L14.4 10.5H22.5L17.74 3.83zM1.5 12l4.5 7.8 4.5-7.8H1.5zm7.62 0l4.5 7.8 4.5-7.8H9.12zm7.62 0l4.5 7.8L22.5 12h-5.76z"/>
                          </svg>
                          <a href={detalhe.driveLink} target="_blank" rel="noopener noreferrer"
                            className="text-sm text-blue-600 font-medium hover:underline truncate">
                            Abrir no Google Drive
                          </a>
                        </div>
                        <button onClick={() => setDriveInput(detalhe.driveLink ?? "")}
                          className="text-[10px] text-blue-500 hover:text-blue-700 shrink-0 font-medium">Editar</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mb-3 italic">Nenhum documento vinculado.</p>
                  )}

                  <div className="flex gap-2">
                    <input
                      value={driveInput}
                      onChange={(e) => setDriveInput(e.target.value)}
                      placeholder="Cole o link do Google Drive..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                    />
                    <button
                      onClick={salvarDriveLink}
                      disabled={salvandoLink || driveInput.trim() === (detalhe.driveLink ?? "")}
                      className="px-3 py-2 rounded-lg bg-[#fb4d06] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 whitespace-nowrap">
                      {salvandoLink ? "..." : "Salvar"}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">Cole o link de uma pasta ou arquivo do Google Drive para fácil acesso.</p>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Modal: Novo Fornecedor Inline ── */}
      {modalNovoFornecedor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalNovoFornecedor(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-800">Novo Fornecedor</h2>
                <p className="text-xs text-gray-400 mt-0.5">Cadastre um novo fornecedor para vincular à conta.</p>
              </div>
              <button onClick={() => setModalNovoFornecedor(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Razão Social <span className="text-red-400">*</span></label>
                <input value={formNovoFornecedor.razaoSocial} onChange={(e) => setFormNovoFornecedor((f) => ({ ...f, razaoSocial: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nome Fantasia</label>
                  <input value={formNovoFornecedor.nomeFantasia} onChange={(e) => setFormNovoFornecedor((f) => ({ ...f, nomeFantasia: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">CNPJ</label>
                  <input value={formNovoFornecedor.cnpj} onChange={(e) => setFormNovoFornecedor((f) => ({ ...f, cnpj: e.target.value }))}
                    placeholder="00.000.000/0001-00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Dados Bancários</label>
                <textarea value={formNovoFornecedor.dadosBancarios} onChange={(e) => setFormNovoFornecedor((f) => ({ ...f, dadosBancarios: e.target.value }))}
                  placeholder="Banco, agência, conta, chave PIX..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalNovoFornecedor(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button onClick={async () => {
                  if (!formNovoFornecedor.razaoSocial.trim()) return;
                  setSalvandoFornecedor(true);
                  try {
                    const res = await fetch("/api/fornecedores", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ...formNovoFornecedor, status: "Ativo" }),
                    });
                    const novo = await res.json();
                    setFornecedores((prev) => [...prev, novo]);
                    setForm((prev) => ({ ...prev, fornecedorId: novo.id, fornecedor: novo.razaoSocial || novo.nomeFantasia }));
                    setFormNovoFornecedor({ razaoSocial: "", nomeFantasia: "", cnpj: "", dadosBancarios: "" });
                    setModalNovoFornecedor(false);
                    setFornecedorBusca("");
                  } finally {
                    setSalvandoFornecedor(false);
                  }
                }} disabled={salvandoFornecedor || !formNovoFornecedor.razaoSocial.trim()}
                  className="flex-[2] py-2.5 rounded-xl bg-[#fb4d06] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40">
                  {salvandoFornecedor ? "Salvando..." : "Cadastrar e Vincular"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar Pagamento ── */}
      {modalPagar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalPagar(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Confirmar Pagamento</h2>
              <p className="text-xs text-gray-400 mt-0.5">O lançamento será criado automaticamente no Fluxo de Caixa.</p>
            </div>

            {/* Resumo da conta */}
            <div className="px-6 pt-5 pb-3">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-4">
                <p className="text-xs text-gray-500 mb-0.5">Fornecedor</p>
                <p className="font-semibold text-gray-800">{modalPagar.fornecedor}</p>
                <p className="text-sm text-gray-500 mt-0.5">{modalPagar.descricao}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500">{modalPagar.categoria}</span>
                  <span className="text-lg font-bold text-red-600">{fmt(modalPagar.valor)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Data do Pagamento</label>
                  <input type="date" value={formPagar.dataPagamento}
                    onChange={(e) => setFormPagar((f) => ({ ...f, dataPagamento: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Modalidade</label>
                    <select value={formPagar.modalidade} onChange={(e) => setFormPagar((f) => ({ ...f, modalidade: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                      {MODALIDADES.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Banco</label>
                    <select value={formPagar.banco} onChange={(e) => setFormPagar((f) => ({ ...f, banco: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                      {bancos.map((b) => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-green-700 font-medium">
                    Será lançado no Fluxo de Caixa como <strong>{modalPagar.categoria}</strong> — <strong>{modalPagar.area}</strong> com valor de <strong>{fmt(modalPagar.valor)}</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 flex gap-3">
              <button onClick={() => setModalPagar(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmarPagamento} disabled={pagando || !formPagar.dataPagamento}
                className="flex-[2] py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-40 flex items-center justify-center gap-2">
                {pagando
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Registrando...</>
                  : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> Confirmar Pagamento</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal: Importar Planilha ── */}
      {showModalImportar && (
        <ModalImportarPlanilha
          onClose={() => { setShowModalImportar(false); setImportPreview(null); }}
          preview={importPreview}
          setPreview={setImportPreview}
          importando={importando}
          setImportando={setImportando}
          onImportado={() => {
            fetch("/api/contas-a-pagar")
              .then((r) => r.json())
              .then((d) => setContas(d.contas ?? []));
            setShowModalImportar(false);
            setImportPreview(null);
          }}
        />
      )}
    </WorkspaceLayout>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENTE: Modal de Importação de Planilha
// ═══════════════════════════════════════════════════════════

function ModalImportarPlanilha({
  onClose, preview, setPreview, importando, setImportando, onImportado,
}: {
  onClose: () => void;
  preview: ImportPreview;
  setPreview: (v: ImportPreview) => void;
  importando: boolean;
  setImportando: (v: boolean) => void;
  onImportado: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [arquivoNome, setArquivoNome] = useState("");

  async function handleFile(file: File) {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".CSV") && !file.name.endsWith(".tsv")) {
      alert("Apenas arquivos CSV são aceitos.");
      return;
    }
    setArquivoNome(file.name);
    setImportando(true);
    const formData = new FormData();
    formData.append("arquivo", file);
    try {
      const res = await fetch("/api/contas-a-pagar/importar", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Erro ao processar arquivo.");
        return;
      }
      const data = await res.json();
      setPreview(data);
    } catch {
      alert("Erro ao enviar arquivo.");
    } finally {
      setImportando(false);
    }
  }

  async function confirmarImportacao() {
    if (!arquivoNome) return;
    setImportando(true);
    const input = document.querySelector<HTMLInputElement>("#csv-import-input");
    const file = input?.files?.[0];
    if (!file) { setImportando(false); return; }

    const formData = new FormData();
    formData.append("arquivo", file);
    formData.append("confirmar", "true");
    try {
      const res = await fetch("/api/contas-a-pagar/importar", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Erro ao importar.");
        return;
      }
      const data = await res.json();
      alert(`${data.importadas} conta(s) importada(s) com sucesso!${data.erros > 0 ? `\n${data.erros} linha(s) ignoradas por erros.` : ""}`);
      onImportado();
    } catch {
      alert("Erro ao importar.");
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-800">Importar Planilha</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Faça upload de um arquivo <strong>CSV</strong> com os dados das contas a pagar.
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {/* Exemplo de formato */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs text-blue-800">
                <p className="font-semibold mb-1">Formato esperado do CSV:</p>
                <code className="block bg-white/70 rounded-lg p-2.5 text-[10px] leading-relaxed">
                  Vencimento;Fornecedor;Descrição;Valor;Modalidade;Banco;Área;Categoria;Obs
                </code>
                <p className="mt-1">
                  Use <strong>;</strong> como separador. A primeira linha deve ser o cabeçalho com os nomes das colunas.
                  Colunas opcionais: <em>Modalidade</em>, <em>Banco</em>, <em>Área</em>, <em>Categoria</em>, <em>Obs</em>, <em>Recorrente</em>, <em>Periodicidade</em>.
                </p>
              </div>
            </div>
          </div>

          {/* Upload area */}
          {!preview && (
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className={`cursor-pointer flex flex-col items-center gap-4 border-2 border-dashed rounded-xl p-10 transition ${
                dragOver ? "border-[#fb4d06] bg-[#fb4d06]/5" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Clique para selecionar ou arraste o arquivo CSV</p>
                <p className="text-xs text-gray-400 mt-1">Arquivo exportado do Excel, Google Sheets ou similar</p>
              </div>
              <input
                id="csv-import-input"
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>
          )}

          {/* Carregando */}
          {importando && !preview && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#fb4d06] border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-gray-500">Processando arquivo...</span>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div>
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <p className="text-2xl font-bold text-gray-700">{preview.total}</p>
                  <p className="text-xs text-gray-500">Total de linhas</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
                  <p className="text-2xl font-bold text-green-600">{preview.validas}</p>
                  <p className="text-xs text-green-600">Válidas</p>
                </div>
                <div className={`rounded-xl p-3 text-center border ${preview.erros > 0 ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
                  <p className={`text-2xl font-bold ${preview.erros > 0 ? "text-red-600" : "text-gray-400"}`}>{preview.erros}</p>
                  <p className={`text-xs ${preview.erros > 0 ? "text-red-500" : "text-gray-400"}`}>Com erros</p>
                </div>
              </div>

              {/* Tabela de preview */}
              {preview.linhas.length > 0 && (
                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">#</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Vencimento</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Fornecedor</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Descrição</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-500">Valor</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.linhas.map((linha) => (
                        <tr key={linha.linha} className={`border-b border-gray-50 ${linha.erros.length > 0 ? "bg-red-50/30" : ""}`}>
                          <td className="px-3 py-2 text-gray-400">{linha.linha}</td>
                          <td className="px-3 py-2 text-gray-700">{linha.mapeado?.dataVencimento || "—"}</td>
                          <td className="px-3 py-2 font-medium text-gray-800">{linha.mapeado?.fornecedor || "—"}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate">{linha.mapeado?.descricao || "—"}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-700">
                            {linha.mapeado?.valor ? fmt(parseFloat(linha.mapeado.valor)) : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {linha.erros.length > 0 ? (
                              <span className="text-red-600 text-[10px] font-medium" title={linha.erros.join("; ")}>
                                ⚠ {linha.erros[0].substring(0, 40)}{linha.erros[0].length > 40 ? "..." : ""}
                              </span>
                            ) : (
                              <span className="text-green-600 text-[10px] font-medium flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                OK
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {preview.haMais && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Mostrando as primeiras {preview.totalExibido} de {preview.total} linhas.
                </p>
              )}

              {preview.validas === 0 && (
                <p className="text-sm text-red-600 mt-4 text-center font-medium">
                  Nenhuma linha válida. Verifique o formato e tente novamente.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between gap-3">
          {preview ? (
            <>
              <button
                onClick={() => {
                  setPreview(null);
                  setArquivoNome("");
                }}
                className="py-2.5 px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Escolher outro arquivo
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} className="py-2.5 px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                  Cancelar
                </button>
                <button
                  onClick={confirmarImportacao}
                  disabled={importando || preview.validas === 0}
                  className="py-2.5 px-6 rounded-xl bg-[#fb4d06] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition flex items-center gap-2"
                >
                  {importando ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importando...</>
                  ) : (
                    <>Importar {preview.validas} conta(s) válida(s)</>
                  )}
                </button>
              </div>
            </>
          ) : (
            <button onClick={onClose} className="py-2.5 px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
