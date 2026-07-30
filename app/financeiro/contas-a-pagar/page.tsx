"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { useUser } from "@clerk/nextjs";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import AvatarIniciais from "@/app/components/AvatarIniciais";
import ParticipantesAvatar from "@/app/components/ParticipantesAvatar";
import { downloadCSV } from "@/lib/export-csv";
import { parseBrl } from "@/lib/parseBrl";
import ModalRecorrenciaPersonalizada from "@/app/components/ModalRecorrenciaPersonalizada";
import type { RecorrenciaConfig } from "@/app/types";

interface Conta {
  id: string;
  userId?: string;
  userName?: string;
  participantes?: { userId: string; nome: string }[];
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
  recorrentePersonalizado?: boolean;
  intervaloValor?: number;
  intervaloUnidade?: string;
  qtdParcelas?: number;
  fluxoCaixaId?: string;
  driveLink?: string;
  boletoUrl?: string;
  fluxoComprovanteUrl?: string;
  dadosBancarios?: {
    nome?: string;
    banco?: string;
    chavePix?: string;
    agencia?: string;
    conta?: string;
  };
  ordemServicoId?: string;
  cliente?: string;
  origem?: string;
  createdAt: string;
  isLote?: boolean;
  loteItens?: {
    tipo: "logistica" | "despesa";
    reembolsoId: string;
    descricao: string;
    valor: number;
  }[];
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

const MODALIDADES = ["PIX", "TED", "DÉBITO", "BOLETO", "FATURA", "INVESTIMENTO", "TRANSFERENCIA"];

const CATEGORIAS_FALLBACK = [
  "RECEITA OPERACIONAL BRUTA", "CUSTOS DIRETOS DOS SERVIÇOS", "DESPESAS ADM E GERAIS",
  "DESPESAS COM PESSOAL OPERACIONAL", "DESPESAS COM PESSOAL — PROLABORE",
  "DEDUÇÕES DA RECEITA (IMPOSTOS)", "DESPESAS COMERCIAIS", "RESULTADO FINANCEIRO",
  "EMPRÉSTIMO THIEMY", "EMPRÉSTIMO FERNANDO", "DEVOLUÇÃO THIEMY", "DEVOLUÇÃO FERNANDO", "ESTORNO",
];

const COR_BANCO_PADRAO: Record<string, { cor: string; bg: string; abrev: string }> = {
  "C6 BANK": { cor: "text-yellow-700", bg: "bg-yellow-50", abrev: "C6" },
  "Banco Itaú": { cor: "text-blue-700", bg: "bg-blue-50", abrev: "Itaú" },
  "NUBANK": { cor: "text-purple-700", bg: "bg-purple-50", abrev: "Nubank" },
};
function corBanco(banco: string | null | undefined) {
  if (!banco) return { cor: "text-gray-400", bg: "bg-gray-50", abrev: "—" };
  return COR_BANCO_PADRAO[banco] || { cor: "text-gray-700", bg: "bg-gray-50", abrev: banco.substring(0, 6) };
}
const AREAS_FALLBACK = ["PROJETOS", "DIGITAL", "MISTO", "ESTORNO"];
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

function formatPeriodicidade(c: Conta): string {
  if (!c.recorrente) return "";
  if (c.periodicidade === "personalizado") {
    const val = (c as any).intervaloValor ?? 1;
    const unidade = (c as any).intervaloUnidade ?? "dia";
    const label: Record<string, string> = { dia: "dia(s)", mes: "mês(es)", ano: "ano(s)", semana: "semana(s)" };
    return `↻ ${val} ${label[unidade] ?? unidade}`;
  }
  return `↻ ${c.periodicidade}`;
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
  recorrentePersonalizado: false,
  intervaloValor: 30,
  intervaloUnidade: "dia" as "dia" | "mes" | "ano",
  qtdParcelas: 12,
  ordemServicoId: "",
  cliente: "",
  status: "pendente",
  dataPagamento: "",
};

export default function ContasAPagarPage() {
  const { user } = useUser();
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [bancos, setBancos] = useState(["C6 BANK", "Banco Itaú"]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [showModalCategorias, setShowModalCategorias] = useState(false);
  const [showModalAreas, setShowModalAreas] = useState(false);
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
      .then((d) => {
        if (d.bancos?.length) setBancos(d.bancos);
        if (d.categorias?.length) setCategorias(d.categorias);
        if (d.areas?.length) setAreas(d.areas);
      })
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
  const [showUltimos, setShowUltimos] = useState(false);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");

  // Modal editar/criar
  const [modalForm, setModalForm] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);
  const [form, setForm] = useState({ ...FORM_VAZIO });
  const [salvando, setSalvando] = useState(false);
  const [showModalRecorrencia, setShowModalRecorrencia] = useState(false);
  const [modalEditarRecorrente, setModalEditarRecorrente] = useState(false);
  const [acaoRecorrente, setAcaoRecorrente] = useState<"this" | "all" | "thisAndFuture" | null>(null);
  const [editandoRecorrente, setEditandoRecorrente] = useState<Conta | null>(null);

  const [boletoUploading, setBoletoUploading] = useState(false);
  const [boletoUrl, setBoletoUrl] = useState("");
  const [editandoLoteItens, setEditandoLoteItens] = useState<{ tipo: "logistica" | "despesa"; reembolsoId: string; descricao: string; valor: number }[]>([]);

  // Modal pagar
  const [modalPagar, setModalPagar] = useState<Conta | null>(null);
  const [formPagar, setFormPagar] = useState({ dataPagamento: "", modalidade: "PIX", banco: "C6 BANK" });
  const [pagando, setPagando] = useState(false);

  // Importar planilha
  const [showModalImportar, setShowModalImportar] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview>(null);
  const [importando, setImportando] = useState(false);

  // Importar fatura C6

  // Painel de detalhe
  const [detalhe, setDetalhe] = useState<Conta | null>(null);
  const [expandedLotes, setExpandedLotes] = useState<Set<string>>(new Set());
  function toggleExpandLote(id: string) {
    setExpandedLotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const [driveInput, setDriveInput] = useState("");
  const [salvandoLink, setSalvandoLink] = useState(false);
  const [dadosBancariosForm, setDadosBancariosForm] = useState({ nome: "", banco: "", chavePix: "", agencia: "", conta: "" });
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    fetch("/api/contas-a-pagar")
      .then((r) => r.json())
      .then((d) => setContas(d.contas ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.ok ? r.json() : [])
      .then(setUsuarios)
      .catch(() => {});
  }, []);

  // Contas do mês selecionado
  const contasMes = useMemo(() => {
    return contas.filter((c) => {
      // Reembolsos (isLote) sempre usam dataVencimento como referência
      // Demais contas usam dataVencimento também (dataPagamento é evento, não período)
      const ref = c.dataVencimento;
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
    if (filtroUsuario === "meus") lista = lista.filter((c) => c.userId === user?.id);
    else if (filtroUsuario) lista = lista.filter((c) => c.userId === filtroUsuario);
    return lista.sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
  }, [contasMes, statusFiltro, areaFiltro, catFiltro, busca, filtroUsuario, user?.id]);

  const ultimosManuais = useMemo(() => {
    return [...contas]
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 15);
  }, [contas]);

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

  function exportCSV() {
    const headers = ["Vencimento", "Pagamento", "Fornecedor", "Descrição", "Valor", "Modalidade", "Banco", "Área", "Categoria", "Status", "Dias", "OS", "Observação"];
    const rows = contasFiltradas.map((c) => {
      const status = statusEfetivo(c);
      const dias = status === "vencido"
        ? `Vencido há ${Math.abs(diasParaVencer(c.dataVencimento))}`
        : status === "pendente"
          ? `Faltam ${diasParaVencer(c.dataVencimento)}`
          : "";
      const os = c.ordemServicoId && osPorId[c.ordemServicoId]
        ? `#${osPorId[c.ordemServicoId].numero}`
        : "";
      const fmtData = (d?: string) => d ? `${d.split("-")[2]}/${d.split("-")[1]}/${d.split("-")[0]}` : "";
      return [
        fmtData(c.dataVencimento),
        fmtData(c.dataPagamento),
        c.fornecedor,
        c.descricao,
        String(c.valor),
        c.modalidade,
        c.banco,
        c.area,
        c.categoria,
        status,
        dias,
        os,
        c.obs ?? "",
      ];
    });
    const mesAno = `${String(mesSel + 1).padStart(2, "0")}-${anoSel}`;
    downloadCSV(`contas-a-pagar_${mesAno}.csv`, headers, rows);
  }

  async function exportPDF() {
    const mesAno = `${String(mesSel + 1).padStart(2, "0")}-${anoSel}`;
    const linhas = contasFiltradas.map((c) => {
      const os = c.ordemServicoId && osPorId[c.ordemServicoId] ? `#${osPorId[c.ordemServicoId].numero}` : "";
      return {
        vencimento: c.dataVencimento,
        pagamento: c.dataPagamento ?? "",
        fornecedor: c.fornecedor,
        descricao: c.descricao,
        valor: c.valor,
        modalidade: c.modalidade,
        banco: c.banco,
        area: c.area,
        categoria: c.categoria,
        status: statusEfetivo(c),
        os,
        obs: c.obs ?? "",
      };
    });
    const totalMes = contasFiltradas.reduce((s, c) => s + c.valor, 0);
    const totalPendente = contasFiltradas.filter((c) => statusEfetivo(c) === "pendente").reduce((s, c) => s + c.valor, 0);
    const totalPago = contasFiltradas.filter((c) => statusEfetivo(c) === "pago").reduce((s, c) => s + c.valor, 0);
    const totalVencido = contasFiltradas.filter((c) => statusEfetivo(c) === "vencido").reduce((s, c) => s + c.valor, 0);
    const res = await fetch("/api/financeiro/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "contas-pagar",
        titulo: "Contas a Pagar",
        periodo: mesAno,
        linhas,
        totalMes, totalPendente, totalPago, totalVencido,
      }),
    });
    if (!res.ok) { alert("Erro ao gerar PDF"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `contas-a-pagar_${mesAno}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function abrirNovo() {
    setEditando(null);
    setForm({ ...FORM_VAZIO, dataVencimento: new Date(anoSel, mesSel, 15).toISOString().split("T")[0] });
    setBoletoUrl("");
    setModalForm(true);
  }

  function abrirEditar(c: Conta) {
    // Se fizer parte de uma série recorrente, pergunta como editar
    const ehRecorrente = c.recorrente || (c as any)._parcelaDe;
    if (ehRecorrente) {
      setEditandoRecorrente(c);
      setModalEditarRecorrente(true);
      return;
    }

    setEditando(c);
    setForm({
      dataVencimento: c.dataVencimento, fornecedor: c.fornecedor, fornecedorId: c.fornecedorId ?? "", descricao: c.descricao,
      valor: String(c.valor), modalidade: c.modalidade, banco: c.banco, area: c.area,
      categoria: c.categoria, obs: c.obs ?? "",
      recorrente: c.recorrente ?? false, periodicidade: c.periodicidade ?? "mensal",
      recorrentePersonalizado: (c as any).periodicidade === "personalizado",
      intervaloValor: (c as any).intervaloValor ?? 30,
      intervaloUnidade: (c as any).intervaloUnidade ?? "dia",
      qtdParcelas: (c as any).qtdParcelas ?? 12,
      ordemServicoId: c.ordemServicoId ?? "",
      cliente: c.cliente ?? "",
      status: c.status,
      dataPagamento: c.dataPagamento ?? "",
    });
    setBoletoUrl(c.boletoUrl ?? "");
    setEditandoLoteItens(c.isLote ? (c.loteItens || []).map((item) => ({ ...item })) : []);
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

  function continuarEditarRecorrente(acao: "this" | "all" | "thisAndFuture") {
    setAcaoRecorrente(acao);
    setModalEditarRecorrente(false);
    const c = editandoRecorrente!;
    setEditando(c);
    setForm({
      dataVencimento: c.dataVencimento, fornecedor: c.fornecedor, fornecedorId: c.fornecedorId ?? "", descricao: c.descricao,
      valor: String(c.valor), modalidade: c.modalidade, banco: c.banco, area: c.area,
      categoria: c.categoria, obs: c.obs ?? "",
      recorrente: c.recorrente ?? false, periodicidade: c.periodicidade ?? "mensal",
      recorrentePersonalizado: (c as any).periodicidade === "personalizado",
      intervaloValor: (c as any).intervaloValor ?? 30,
      intervaloUnidade: (c as any).intervaloUnidade ?? "dia",
      qtdParcelas: (c as any).qtdParcelas ?? 12,
      ordemServicoId: c.ordemServicoId ?? "",
      cliente: c.cliente ?? "",
      status: c.status,
      dataPagamento: c.dataPagamento ?? "",
    });
    setBoletoUrl(c.boletoUrl ?? "");
    setEditandoLoteItens(c.isLote ? (c.loteItens || []).map((item) => ({ ...item })) : []);
    setModalForm(true);
  }

  async function salvarConta() {
    if (!form.dataVencimento) return;
    if (!editando?.isLote && !form.descricao.trim()) return;
    setSalvando(true);
    const valorLote = editando?.isLote
      ? editandoLoteItens.reduce((s, i) => s + (i.valor || 0), 0)
      : 0;
    const payload: any = {
      ...form,
      valor: valorLote || parseBrl(String(form.valor)),
      boletoUrl: boletoUrl || undefined,
      intervaloValor: form.recorrentePersonalizado ? form.intervaloValor : undefined,
      intervaloUnidade: form.recorrentePersonalizado ? form.intervaloUnidade : undefined,
      qtdParcelas: form.recorrentePersonalizado ? form.qtdParcelas : undefined,
    };
    if (editando?.isLote) {
      payload.loteItens = editandoLoteItens;
    }
    // Propaga o modo de edição para a API quando for conta recorrente
    if (acaoRecorrente && editando) {
      payload._updateMode = acaoRecorrente;
      payload._updateModeRef = (editando as any)._parcelaDe || editando.id;
    }
    try {
      if (editando) {
        const res = await fetch(`/api/contas-a-pagar/${editando.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json();
        // Se propagou para várias, atualiza todas na lista local
        if (acaoRecorrente && data.contasAtualizadas) {
          setContas((prev) => prev.map((c) => {
            const atualizada = data.contasAtualizadas.find((a: any) => a.id === c.id);
            return atualizada ? { ...c, ...atualizada } as Conta : c;
          }));
        } else {
          setContas((prev) => prev.map((c) =>
            c.id === editando.id
              ? { ...c, ...payload, ...(data.fluxoCaixaId ? { fluxoCaixaId: data.fluxoCaixaId } : {}) } as Conta
              : c
          ));
        }
        setAcaoRecorrente(null);
      } else {
        const res = await fetch("/api/contas-a-pagar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const result = await res.json();
        const contasCriadas = Array.isArray(result.contas) ? result.contas : [result];
        setContas((prev) => [...prev, ...contasCriadas]);
        if (result.criadas > 1) {
          alert(`${result.criadas} parcelas geradas (${form.periodicidade}).`);
        }
      }
      setModalForm(false);
    } finally {
      setSalvando(false);
    }
  }

  function aplicarRecorrenciaPersonalizada(config: RecorrenciaConfig) {
    const { intervalo, unidade, termino } = config;

    let intervaloValor = intervalo;
    let intervaloUnidade: "dia" | "mes" | "ano" = "dia";

    if (unidade === "semana") {
      intervaloValor = intervalo * 7;
      intervaloUnidade = "dia";
    } else {
      intervaloUnidade = unidade;
    }

    let qtdParcelas: number;
    if (termino.tipo === "apos") {
      qtdParcelas = termino.ocorrencias ?? 12;
    } else if (termino.tipo === "em") {
      // Estima parcelas da data inicial até a data final
      const hoje = new Date();
      const fim = termino.data
        ? new Date(termino.data.split("/").reverse().join("-") + "T12:00:00")
        : new Date(hoje.getFullYear() + 1, hoje.getMonth(), hoje.getDate());
      const diffMs = fim.getTime() - hoje.getTime();
      if (intervaloUnidade === "dia") {
        qtdParcelas = Math.max(1, Math.ceil(diffMs / (intervaloValor * 86400000)));
      } else if (intervaloUnidade === "mes") {
        qtdParcelas = Math.max(1, Math.ceil(diffMs / (intervalo * 30 * 86400000)));
      } else {
        qtdParcelas = Math.max(1, Math.ceil(diffMs / (intervalo * 365 * 86400000)));
      }
    } else {
      qtdParcelas = 52; // "nunca" — default alto
    }

    setForm((f) => ({
      ...f,
      recorrente: true,
      recorrentePersonalizado: true,
      periodicidade: "personalizado",
      intervaloValor,
      intervaloUnidade,
      qtdParcelas: Math.min(qtdParcelas, 120),
    }));
    setShowModalRecorrencia(false);
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
    const payload = { ...form, valor: parseBrl(String(form.valor)) };
    try {
      const res = await fetch("/api/contas-a-pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      const contasCriadas = Array.isArray(result.contas) ? result.contas : [result];
      setContas((prev) => [...prev, ...contasCriadas]);
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
            <div className="relative">
              <button onClick={() => setShowExportMenu(p => !p)}
                className="border border-gray-200 text-gray-600 font-semibold py-2 px-5 rounded-xl hover:bg-gray-50 transition flex items-center gap-2 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportar
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[180px] py-1">
                    <button onClick={() => { exportCSV(); setShowExportMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      CSV (Planilha)
                    </button>
                    <button onClick={() => { exportPDF(); setShowExportMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      PDF (Relatório)
                    </button>
                  </div>
                </>
              )}
            </div>
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
            {(() => {
              const anos = [...new Set(contas.map((c) => new Date(c.dataVencimento + "T12:00:00").getFullYear()))].sort();
              if (anos.length === 0) anos.push(anoSel);
              return anos.map((a) => (
                <button key={a} onClick={() => setAnoSel(a)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition ${anoSel === a ? "bg-gray-200 text-gray-800" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}>{a}</button>
              ));
            })()}
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
              {(areas.length ? areas : AREAS_FALLBACK).map((a) => <option key={a}>{a}</option>)}
            </select>
            <select value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 flex-1 min-w-40">
              <option value="Todas">Todas categorias</option>
              {(categorias.length ? categorias : CATEGORIAS_FALLBACK).map((c) => <option key={c}>{c}</option>)}
            </select>
            {usuarios.length > 0 && (
              <select value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                <option value="">👤 Todos</option>
                <option value="meus">🙋 Meus registros</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            )}
            <span className="text-xs text-gray-400 ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowUltimos((v) => !v)}
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded border transition ${
                  showUltimos
                    ? "bg-gray-100 text-gray-500 border-gray-300"
                    : "text-gray-300 border-transparent hover:text-gray-400 hover:border-gray-200"
                }`}
                title="Ver últimas contas cadastradas"
              >
                Últimos
              </button>
              {contasFiltradas.length} conta(s)
            </span>
          </div>

          {showUltimos && (
            <div className="border-b border-gray-100 px-4 py-3 bg-gray-50/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">Últimas contas cadastradas</span>
                <button onClick={() => setShowUltimos(false)} className="text-xs text-gray-300 hover:text-gray-500 transition">Fechar</button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {ultimosManuais.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Nenhuma conta encontrada.</p>
                ) : ultimosManuais.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-white text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[10px] font-mono whitespace-nowrap ${
                        statusEfetivo(c) === "vencido" ? "text-red-400" :
                        statusEfetivo(c) === "pendente" ? "text-amber-400" : "text-gray-400"
                      }`}>
                        {(() => { const [a,m,d] = c.dataVencimento.split("-"); return `${d}/${m}`; })()}
                      </span>
                      <span className="text-gray-600 font-medium truncate max-w-[160px]">
                            {c.fornecedor}
                            {c.origem === "fornecedor-os" && (
                              <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 align-middle">
                                OS
                              </span>
                            )}
                          </span>
                      <span className="text-gray-400 truncate max-w-[180px]">{c.descricao}</span>
                    </div>
                    <span className="font-medium whitespace-nowrap text-red-500">R$ {c.valor.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Criado por</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contasFiltradas.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">Nenhuma conta encontrada para este período.</td></tr>
                )}
                {contasFiltradas.map((c) => {
                  const st = statusEfetivo(c);
                  const cfg = STATUS_CONFIG[st];
                  const dias = diasParaVencer(c.dataVencimento);
                  return (
                    <Fragment key={c.id}>
                      <tr onClick={c.isLote ? () => toggleExpandLote(c.id) : () => abrirDetalhe(c)} className={`border-b border-gray-50 group hover:bg-gray-50/50 cursor-pointer ${st === "vencido" ? "bg-red-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {c.isLote && (
                            <button onClick={(e) => { e.stopPropagation(); toggleExpandLote(c.id); }}
                              className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-[#fb4d06] hover:bg-orange-50 transition">
                              <svg className={`w-3.5 h-3.5 transition-transform ${expandedLotes.has(c.id) ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          )}
                          <div>
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
                                {formatPeriodicidade(c)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {c.isLote ? (
                          <>
                            <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                              <span className="text-base">📦</span>
                              Lote de reembolsos
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {c.loteItens?.length || 0} itente{c.loteItens?.length !== 1 ? "ns" : "m"} · {new Date(c.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-gray-800">
                                {c.fornecedor}
                                {c.origem === "fornecedor-os" && (
                                  <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 align-middle">
                                    Fornecedor
                                  </span>
                                )}
                              </p>
                            <p className="text-xs text-gray-500 mt-0.5">{c.descricao}</p>
                          </>
                        )}
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
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <AvatarIniciais nome={c.userName || "?"} size="sm" />
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">{c.userName || "—"}</span>
                            {c.userId === user?.id && (
                              <span className="text-[9px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-medium leading-none">Eu</span>
                            )}
                          </div>
                          {c.participantes && c.participantes.length > 0 && (
                            <ParticipantesAvatar participantes={c.participantes} />
                          )}
                        </div>
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
                    {c.isLote && expandedLotes.has(c.id) && (
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <td colSpan={9} className="px-4 py-2">
                          <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 px-4 py-2">
                            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Descrição</div>
                            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Valor</div>
                            {c.loteItens?.map((item, idx) => (
                              <Fragment key={item.reembolsoId}>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                    item.tipo === "logistica" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                                  }`}>
                                    {item.tipo === "logistica" ? "LOGÍSTICA" : "DESPESA"}
                                  </span>
                                  <span className="text-gray-700">{item.descricao}</span>
                                </div>
                                <div className="text-sm font-semibold text-red-600 text-right">{fmt(item.valor)}</div>
                              </Fragment>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
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
      {showModalCategorias && (
        <GerenciarCategoriasModal
          categorias={categorias.length ? categorias : CATEGORIAS_FALLBACK}
          onClose={() => setShowModalCategorias(false)}
          onSalvar={async (novas) => {
            await fetch("/api/config", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ categorias: novas }),
            });
            setCategorias(novas);
            setShowModalCategorias(false);
          }}
        />
      )}

      {showModalAreas && (
        <GerenciarCategoriasModal
          categorias={areas.length ? areas : AREAS_FALLBACK}
          titulo="Áreas"
          onClose={() => setShowModalAreas(false)}
          onSalvar={async (novas) => {
            await fetch("/api/config", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ areas: novas }),
            });
            setAreas(novas);
            setShowModalAreas(false);
          }}
        />
      )}

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
                <label className="block text-xs font-medium text-gray-500 mb-1">Fornecedor / Beneficiário</label>
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
                    <input value={fornecedorBusca} onChange={(e) => { setFornecedorBusca(e.target.value); }}
                      placeholder="Digite para buscar fornecedor cadastrado..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                    {fornecedorBusca.trim() && fornecedoresFiltrados.length > 0 && (
                      <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                        {fornecedoresFiltrados.map((f) => (
                          <button key={f.id} type="button"
                            onMouseDown={(e) => {
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
                {!form.fornecedorId && !fornecedorBusca.trim() && (
                  <button type="button" onClick={() => setModalNovoFornecedor(true)}
                    className="mt-1 text-xs font-semibold text-[#fb4d06] hover:underline flex items-center gap-1">
                    + Cadastrar novo fornecedor
                  </button>
                )}
                {form.fornecedorId && fornecedores.find((f) => f.id === form.fornecedorId)?.dadosBancarios && (
                  <p className="text-[10px] text-gray-500 mt-1 bg-gray-50 rounded px-2 py-1 border border-gray-100">
                    <span className="font-medium">Dados bancários:</span> {fornecedores.find((f) => f.id === form.fornecedorId)?.dadosBancarios}
                  </p>
                )}
              </div>

              {/* ── Lote de reembolsos: editar itens individuais ── */}
              {editando?.isLote && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Itens do Lote</p>
                    <span className="text-xs font-semibold text-orange-700">
                      Total: {(editandoLoteItens || []).reduce((s, i) => s + (i.valor || 0), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {(editandoLoteItens || []).map((item, idx) => (
                      <div key={item.reembolsoId} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-orange-100">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          item.tipo === "logistica" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                        }`}>
                          {item.tipo === "logistica" ? "LOG" : "DESP"}
                        </span>
                        <input
                          value={item.descricao}
                          onChange={(e) => {
                            const novos = [...editandoLoteItens];
                            novos[idx] = { ...novos[idx], descricao: e.target.value };
                            setEditandoLoteItens(novos);
                          }}
                          placeholder="Descrição do item"
                          className="flex-1 min-w-0 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.valor}
                          onChange={(e) => {
                            const novos = [...editandoLoteItens];
                            novos[idx] = { ...novos[idx], valor: parseFloat(e.target.value) || 0 };
                            setEditandoLoteItens(novos);
                          }}
                          className="w-28 border border-gray-200 rounded px-2 py-1.5 text-xs text-right font-semibold focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-orange-500 mt-2">Altere a descrição e o valor de cada item. O total será recalculado automaticamente.</p>
                </div>
              )}

              {/* Descrição — oculta quando lote (itens são editados acima) */}
              {!editando?.isLote && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Descrição <span className="text-red-400">*</span></label>
                <input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Salário mensal, Aluguel mai/26..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
              </div>
              )}

              {/* Data + Valor (Valor oculto quando lote) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Data de Vencimento <span className="text-red-400">*</span></label>
                  <input type="date" value={form.dataVencimento} onChange={(e) => setForm((f) => ({ ...f, dataVencimento: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                </div>
                {!editando?.isLote && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Valor (R$)</label>
                  <input type="text" placeholder="0,00 (deixe 0 se indefinido)"
                    value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30" />
                </div>
                )}
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
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Área
                    <button type="button" onClick={() => setShowModalAreas(true)}
                      className="ml-2 text-[10px] text-[#fb4d06] hover:text-[#e04400] font-medium">✎ Gerenciar</button>
                  </label>
                  <select value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                    {(areas.length ? areas : AREAS_FALLBACK).map((a) => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Categoria DRE
                    <button type="button" onClick={() => setShowModalCategorias(true)}
                      className="ml-2 text-[10px] text-[#fb4d06] hover:text-[#e04400] font-medium">✎ Gerenciar</button>
                  </label>
                  <select value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30">
                    {(categorias.length ? categorias : CATEGORIAS_FALLBACK).map((c) => <option key={c}>{c}</option>)}
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
                  const boletoUrlFull = contaId ? `/api/contas-a-pagar/${contaId}/boleto` : null;
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

              {/* Cliente */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
                <input
                  value={form.cliente}
                  onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))}
                  placeholder="Nome do cliente responsável por esta conta"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                />
                <p className="text-[10px] text-gray-400 mt-1">Identifica qual cliente gerou este custo (aparece no dashboard da visão geral).</p>
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
                  <div onClick={() => setForm((f) => ({ ...f, recorrente: !f.recorrente, recorrentePersonalizado: false }))}
                    className={`w-9 h-5 rounded-full relative transition-colors ${form.recorrente ? "bg-[#fb4d06]" : "bg-gray-300"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.recorrente ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Conta recorrente</span>
                </label>
                {form.recorrente && (
                  <>
                    {!form.recorrentePersonalizado ? (
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Periodicidade</label>
                        <div className="flex gap-2 flex-wrap">
                          {PERIODICIDADES.map((p) => (
                            <button key={p} type="button" onClick={() => setForm((f) => ({ ...f, periodicidade: p }))}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition capitalize ${
                                form.periodicidade === p ? "border-[#fb4d06] bg-[#fb4d06]/5 text-[#fb4d06]" : "border-gray-200 text-gray-500 hover:border-gray-300"
                              }`}>{p}</button>
                          ))}
                          <button type="button" onClick={() => setForm((f) => ({ ...f, recorrentePersonalizado: true, periodicidade: "personalizado" }))}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-gray-300 text-gray-500 hover:border-[#fb4d06] hover:text-[#fb4d06] hover:bg-[#fb4d06]/5 transition flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            </svg>
                            Personalizar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-gray-500">Configuração personalizada</label>
                          <button type="button" onClick={() => setForm((f) => ({ ...f, recorrentePersonalizado: false, periodicidade: "mensal" }))}
                            className="text-[11px] font-semibold text-[#fb4d06] hover:underline">
                            Usar predefinidas
                          </button>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              A cada {form.intervaloValor} {form.intervaloUnidade === "dia" ? "dia(s)" : form.intervaloUnidade === "mes" ? "mês(es)" : "ano(s)"}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {form.qtdParcelas} parcelas · {form.periodicidade === "personalizado" ? "personalizado" : form.periodicidade}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowModalRecorrencia(true)}
                            className="text-xs font-semibold text-[#fb4d06] hover:underline flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Editar
                          </button>
                        </div>
                      </div>
                    )}
                  </>
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
              <button onClick={salvarConta} disabled={salvando || !form.dataVencimento || (editando?.isLote ? false : !form.descricao.trim())}
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
                      <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">{formatPeriodicidade(detalhe)}</span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-gray-900 truncate">
                            {detalhe.fornecedor}
                            {detalhe.origem === "fornecedor-os" && (
                              <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 align-middle">
                                Fornecedor
                              </span>
                            )}
                          </h2>
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
                    const result = await res.json();
                    const contasCriadas = Array.isArray(result.contas) ? result.contas : [result];
                    setContas((prev) => [...prev, ...contasCriadas]);
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
                    {detalhe.recorrente ? (
                      <div className="bg-indigo-50 rounded-xl p-3 col-span-2">
                        <p className="text-[10px] font-medium text-indigo-400 uppercase mb-1">Recorrência</p>
                        <p className="text-sm font-semibold text-indigo-800">
                          {detalhe.periodicidade === "personalizado"
                            ? `A cada ${(detalhe as any).intervaloValor ?? 1} ${((detalhe as any).intervaloUnidade) === "dia" ? "dia(s)" : (detalhe as any).intervaloUnidade === "mes" ? "mês(es)" : "ano(s)"} · ${(detalhe as any).qtdParcelas ?? 12} parcelas`
                            : `↻ ${detalhe.periodicidade}`
                          }
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Criado em</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {new Date(detalhe.createdAt + "T12:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    )}
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
                    <a href={`/api/contas-a-pagar/${detalhe.id}/boleto`} target="_blank" rel="noopener noreferrer"
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

                {/* Comprovante do Fluxo de Caixa */}
                {detalhe.fluxoComprovanteUrl && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Comprovante de Pagamento</p>
                    </div>
                    <a href={`/api/fluxo-caixa/${detalhe.fluxoCaixaId}/comprovante`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 hover:bg-green-100 transition group">
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-green-700 group-hover:underline">Abrir comprovante anexado</p>
                        <p className="text-[10px] text-green-500">Comprovante vinculado ao Fluxo de Caixa</p>
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
                    if (!res.ok) throw new Error("Erro ao cadastrar fornecedor");
                    const novo = await res.json();
                    if (!novo?.id) throw new Error("Fornecedor criado sem identificador");
                    setFornecedores((prev) => [...prev, novo]);
                    setForm((prev) => ({ ...prev, fornecedorId: novo.id, fornecedor: novo.razaoSocial || novo.nomeFantasia }));
                    setFormNovoFornecedor({ razaoSocial: "", nomeFantasia: "", cnpj: "", dadosBancarios: "" });
                    setModalNovoFornecedor(false);
                    setFornecedorBusca("");
                  } catch (e) {
                    alert("Erro ao cadastrar fornecedor: " + (e instanceof Error ? e.message : "Erro desconhecido"));
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

      {/* Modal de Edição de Conta Recorrente — escolher escopo */}
      {modalEditarRecorrente && editandoRecorrente && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setModalEditarRecorrente(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Editar conta recorrente</h2>
            <p className="text-sm text-gray-500 mb-6">
              Esta conta faz parte de uma série de parcelas. Como deseja editar?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => continuarEditarRecorrente("this")}
                className="text-left w-full border border-gray-200 rounded-xl p-4 hover:border-[#fb4d06]/40 hover:bg-orange-50/50 transition"
              >
                <span className="font-semibold text-gray-900 block">Alterar apenas esta</span>
                <span className="text-sm text-gray-500">As outras parcelas da série não serão afetadas.</span>
              </button>
              <button
                onClick={() => continuarEditarRecorrente("thisAndFuture")}
                className="text-left w-full border border-gray-200 rounded-xl p-4 hover:border-[#fb4d06]/40 hover:bg-orange-50/50 transition"
              >
                <span className="font-semibold text-gray-900 block">Alterar esta e as seguintes</span>
                <span className="text-sm text-gray-500">Todas as parcelas a partir desta serão alteradas.</span>
              </button>
              <button
                onClick={() => continuarEditarRecorrente("all")}
                className="text-left w-full border border-gray-200 rounded-xl p-4 hover:border-[#fb4d06]/40 hover:bg-orange-50/50 transition"
              >
                <span className="font-semibold text-gray-900 block">Alterar todas</span>
                <span className="text-sm text-gray-500">Todas as parcelas da série serão alteradas, incluindo as anteriores.</span>
              </button>
            </div>
            <button
              onClick={() => { setModalEditarRecorrente(false); setEditandoRecorrente(null); }}
              className="mt-6 w-full text-sm text-gray-400 hover:text-gray-600 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Recorrência Personalizada */}
      {showModalRecorrencia && (
        <ModalRecorrenciaPersonalizada
          valorInicial={{
            intervalo: form.intervaloValor,
            unidade: form.intervaloUnidade === "dia" ? "dia" : form.intervaloUnidade,
            termino: {
              tipo: "apos",
              ocorrencias: form.qtdParcelas,
            },
          }}
          onSalvar={aplicarRecorrenciaPersonalizada}
          onFechar={() => setShowModalRecorrencia(false)}
        />
      )}

    </WorkspaceLayout>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENTE: Gerenciar Categorias
// ═══════════════════════════════════════════════════════════

function GerenciarCategoriasModal({ categorias, onClose, onSalvar, titulo = "Categorias" }: {
  categorias: string[];
  onClose: () => void;
  onSalvar: (novas: string[]) => Promise<void>;
  titulo?: string;
}) {
  const [lista, setLista] = useState([...categorias]);
  const [nova, setNova] = useState("");
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null);
  const [editValor, setEditValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function handleSalvar() {
    setSalvando(true);
    const limpas = lista.filter(Boolean).map((s) => s.trim()).filter(Boolean);
    await onSalvar(limpas);
    setSalvando(false);
  }

  function adicionar() {
    if (!nova.trim()) return;
    setLista((p) => [...p, nova.trim()]);
    setNova("");
  }

  function remover(i: number) {
    setLista((p) => p.filter((_, idx) => idx !== i));
  }

  function iniciarEdicao(i: number) {
    setEditandoIdx(i);
    setEditValor(lista[i]);
  }

  function confirmarEdicao() {
    if (editandoIdx === null || !editValor.trim()) return;
    setLista((p) => p.map((c, i) => i === editandoIdx ? editValor.trim() : c));
    setEditandoIdx(null);
    setEditValor("");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Gerenciar {titulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Adicionar nova */}
          <div className="flex gap-2">
            <input
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }}
              placeholder="Nova categoria..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
            />
            <button onClick={adicionar} disabled={!nova.trim()}
              className="px-3 py-2 text-sm font-medium text-white bg-[#fb4d06] rounded-lg hover:bg-[#e04400] transition disabled:opacity-40">
              + Adicionar
            </button>
          </div>

          {/* Lista */}
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {lista.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Nenhuma categoria cadastrada</p>
            )}
            {lista.map((c, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 group border-b border-gray-50 last:border-0">
                {editandoIdx === i ? (
                  <>
                    <input
                      value={editValor}
                      onChange={(e) => setEditValor(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") confirmarEdicao(); if (e.key === "Escape") setEditandoIdx(null); }}
                      className="flex-1 border border-[#fb4d06] rounded px-2 py-1 text-sm outline-none"
                      autoFocus
                    />
                    <button onClick={confirmarEdicao}
                      className="text-xs text-green-600 hover:text-green-700 font-medium px-2">OK</button>
                    <button onClick={() => setEditandoIdx(null)}
                      className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-700">{c}</span>
                    <button onClick={() => iniciarEdicao(i)}
                      className="text-xs text-gray-400 hover:text-[#fb4d06] transition opacity-0 group-hover:opacity-100 px-1">✎</button>
                    <button onClick={() => remover(i)}
                      className="text-xs text-gray-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100 px-1">✕</button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button onClick={handleSalvar} disabled={salvando}
              className="px-4 py-2 text-sm font-medium text-white bg-[#fb4d06] rounded-lg hover:bg-[#e04400] transition disabled:opacity-50">
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
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

