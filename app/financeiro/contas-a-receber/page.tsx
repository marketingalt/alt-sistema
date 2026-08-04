"use client";

import { Component, useEffect, useState, useMemo, useRef } from "react";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import ComboboxCliente from "@/app/components/ComboboxCliente";
import { calcularCustoTotal, ehCartao, FORMA_LINK_CARTAO, calcularPercTaxaCartao } from "@/lib/calculos";
import { downloadCSV } from "@/lib/export-csv";
import { useUser } from "@clerk/nextjs";
import AvatarIniciais from "@/app/components/AvatarIniciais";
import ParticipantesAvatar from "@/app/components/ParticipantesAvatar";
import type { Orcamento, ItemOrcamento, OrdemServico } from "@/app/types";

// ── Error boundary para capturar erro real ──────────────────────────────────────
class PageErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[PageErrorBoundary]", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "sans-serif" }}>
          <h2 style={{ color: "#e00", marginBottom: 12 }}>Erro ao carregar página</h2>
          <pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, overflow: "auto", fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

interface RegistroFaturamento {
  id?: string;
  orcamentoId?: string;
  tipo?: "manual" | "orcamento";
  cliente?: string;
  job?: string;
  responsavel?: string;
  statusJob?: string;
  valorAprovadoManual?: number;
  custosReais?: number;
  /** Substitui custosReais */
  custo?: number;
  imposto?: number;
  percentualImposto?: number;
  comissao?: number;
  percentualComissao?: number;
  statusNota?: "Pendente" | "Emitida" | "Cancelada";
  numeroNota?: string;
  dataEmissao?: string;
  diasPagamento?: number;
  vencimento?: string;
  pago?: boolean;
  dataPagamento?: string;
  banco?: string;
  modalidade?: string;
  ordemServicoId?: string;
  userId?: string;
  userName?: string;
  participantes?: { userId: string; nome: string }[];
  createdAt?: string;
  updatedAt?: string;
}

interface RowUnificada {
  rowId: string;
  tipo: "manual" | "orcamento";
  cliente: string;
  job: string;
  responsavel: string;
  statusJob: string;
  valorAprovado: number;
  custosCalculados: number;
  fat: RegistroFaturamento;
  orcamento?: Orcamento;
  userId?: string;
  userName?: string;
  participantes?: { userId: string; nome: string }[];
}

function calcCustosOrcamento(orc: Orcamento): number {
  return (orc.itens || []).reduce((acc: number, item: ItemOrcamento) => {
    return acc + calcularCustoTotal(item) * (item.quantidade || 0);
  }, 0);
}

/** Base do orçamento: subtotal + frete + manuseio (sem taxa de cartão) */
function valorLiquidoOrcamento(orc: Orcamento): number {
  const subtotal = (orc.itens || []).reduce((s: number, it: ItemOrcamento) => s + (it.total || 0), 0);
  return subtotal + (orc.freteValor || 0) + (orc.custoManuseio || 0);
}

/** Valor aprovado (bruto, igual à NF): base + taxa de cartão quando forma é link de crédito */
function valorAprovadoOrcamento(orc: Orcamento): number {
  const taxa = orc.formaPagamento === FORMA_LINK_CARTAO ? (orc.taxaCartao || 0) : 0;
  return valorLiquidoOrcamento(orc) + taxa;
}

/** Tenta extrair número de dias de uma string tipo "20 dias", "30 dias à vista". Retorna undefined se não achar número. */
function extrairDiasPrazo(prazo?: string): number | undefined {
  if (!prazo) return undefined;
  const match = prazo.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const MODALIDADES = ["PIX", "TED", "DÉBITO", "BOLETO", "FATURA", "INVESTIMENTO", "TRANSFERENCIA", "CRÉDITO"];

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(n: number) {
  return n.toFixed(1) + "%";
}

function statusReceber(row: RowUnificada): "pago" | "inadimplente" | "aReceber" {
  if (row.fat.pago) return "pago";
  if (row.fat.vencimento && new Date(row.fat.vencimento + "T23:59:59") < new Date()) return "inadimplente";
  return "aReceber";
}

// ── Inline editable cell ──────────────────────────────────────────────────────
type CellMode = "text" | "number" | "date" | "select" | "combobox";
interface CellProps {
  value: string | number | boolean | undefined;
  mode?: CellMode;
  options?: string[];
  placeholder?: string;
  className?: string;
  onSave: (v: string) => void;
}

function Cell({ value, mode = "text", options = [], placeholder = "—", className = "", onSave }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);

  useEffect(() => { setDraft(String(value ?? "")); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== String(value ?? "")) onSave(draft);
  }

  const display = value === undefined || value === null || value === ""
    ? <span className="text-gray-400 italic text-xs">{placeholder}</span>
    : String(value);

  if (!editing) {
    return (
      <span
        className={`cursor-pointer hover:text-[#fb4d06] transition-colors whitespace-nowrap ${className}`}
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      >
        {display}
      </span>
    );
  }

  if (mode === "select") {
    return (
      <select
        ref={ref as React.RefObject<HTMLSelectElement>}
        className="border border-[#fb4d06] rounded px-1 py-0.5 text-xs bg-white outline-none"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (mode === "combobox") {
    return (
      <>
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          type="text"
          list={`cell-list-${draft.slice(0, 6)}`}
          className="border border-[#fb4d06] rounded px-1 py-0.5 text-xs bg-white outline-none w-36"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setEditing(false); setDraft(String(value ?? "")); }
          }}
        />
        <datalist id={`cell-list-${draft.slice(0, 6)}`}>
          {options.map((o) => <option key={o} value={o} />)}
        </datalist>
      </>
    );
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      type={mode === "date" ? "date" : mode === "number" ? "number" : "text"}
      className="border border-[#fb4d06] rounded px-1 py-0.5 text-xs bg-white outline-none w-28"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setEditing(false); setDraft(String(value ?? "")); }
      }}
    />
  );
}

// ── Vencimento cell — dias após emissão ou data direta ───────────────────────
interface CellVencimentoProps {
  value: string | undefined;
  dataEmissao: string | undefined;
  onSave: (v: string) => void;
}

function CellVencimento({ value, dataEmissao, onSave }: CellVencimentoProps) {
  const [aberto, setAberto] = useState(false);
  const [dias, setDias] = useState("");
  const [dataManual, setDataManual] = useState(value || "");
  const [aba, setAba] = useState<"dias" | "data">("dias");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setDataManual(value || ""); }, [value]);

  useEffect(() => {
    if (!aberto) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [aberto]);

  function calcDataPorDias(): string {
    if (!dias || !dataEmissao) return "";
    const base = new Date(dataEmissao + "T12:00:00");
    if (isNaN(base.getTime())) return "";
    base.setDate(base.getDate() + parseInt(dias, 10));
    return base.toISOString().split("T")[0];
  }

  function confirmar() {
    let resultado = "";
    if (aba === "dias") {
      resultado = calcDataPorDias();
      if (!resultado) return;
    } else {
      resultado = dataManual;
      if (!resultado) return;
    }
    onSave(resultado);
    setAberto(false);
    setDias("");
  }

  function formatarData(iso: string) {
    if (!iso) return null;
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  const preview = aba === "dias" && dias ? calcDataPorDias() : null;

  return (
    <div className="relative" ref={ref}>
      <span
        className="cursor-pointer hover:text-[#fb4d06] transition-colors whitespace-nowrap"
        onClick={(e) => { e.stopPropagation(); setAberto(true); setAba("dias"); setDias(""); }}
      >
        {value ? formatarData(value) : <span className="text-gray-400 italic text-xs">—</span>}
      </span>

      {aberto && (
        <div className="absolute z-50 top-6 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-56">
          {/* Tabs */}
          <div className="flex gap-1 mb-3 bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setAba("dias")}
              className={`flex-1 text-xs py-1 rounded-md font-medium transition ${aba === "dias" ? "bg-white shadow text-gray-800" : "text-gray-500"}`}
            >
              Dias após emissão
            </button>
            <button
              type="button"
              onClick={() => setAba("data")}
              className={`flex-1 text-xs py-1 rounded-md font-medium transition ${aba === "data" ? "bg-white shadow text-gray-800" : "text-gray-500"}`}
            >
              Data direta
            </button>
          </div>

          {aba === "dias" ? (
            <div className="flex flex-col gap-2">
              {!dataEmissao && (
                <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1">
                  Defina a data de emissão primeiro
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  placeholder="Ex: 30"
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#fb4d06] w-full"
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmar(); if (e.key === "Escape") setAberto(false); }}
                  autoFocus
                  disabled={!dataEmissao}
                />
                <span className="text-xs text-gray-400 whitespace-nowrap">dias</span>
              </div>
              {preview && (
                <p className="text-[10px] text-gray-500">
                  Vencimento: <span className="font-semibold text-gray-700">{formatarData(preview)}</span>
                </p>
              )}
            </div>
          ) : (
            <input
              type="date"
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#fb4d06] w-full"
              value={dataManual}
              onChange={(e) => setDataManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmar(); if (e.key === "Escape") setAberto(false); }}
              autoFocus
            />
          )}

          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={aba === "dias" ? (!dias || !dataEmissao) : !dataManual}
              className="text-xs font-medium text-white bg-[#fb4d06] px-3 py-1 rounded-lg hover:bg-[#e04400] disabled:opacity-40 transition"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal Novo Lançamento ─────────────────────────────────────────────────────
interface NovoLancamentoModalProps {
  onClose: () => void;
  onSalvar: (dados: Partial<RegistroFaturamento>) => Promise<void>;
  ordensServico?: OrdemServico[];
}

function NovoLancamentoModal({ onClose, onSalvar, ordensServico = [] }: NovoLancamentoModalProps) {
  const [form, setForm] = useState<Partial<RegistroFaturamento>>({
    statusNota: "Pendente",
    pago: false,
  });
  const [salvando, setSalvando] = useState(false);

  function set(field: keyof RegistroFaturamento, val: unknown) {
    setForm((p) => ({ ...p, [field]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente || !form.job || !form.valorAprovadoManual) return;
    setSalvando(true);
    await onSalvar(form);
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Novo Lançamento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <ComboboxCliente
                value={form.cliente || ""}
                onChange={(v) => set("cliente", v)}
                onSelect={(c) => set("cliente", c.nomeEmpresa || c.razaoSocial)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Job *</label>
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.job || ""}
                onChange={(e) => set("job", e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Responsável</label>
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.responsavel || ""}
                onChange={(e) => set("responsavel", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Status do Job</label>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] bg-white"
                value={form.statusJob || ""}
                onChange={(e) => set("statusJob", e.target.value)}
              >
                <option value="">Selecione</option>
                <option>Em andamento</option>
                <option>Enviado</option>
                <option>Aprovado</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Valor Aprovado (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.valorAprovadoManual || ""}
                onChange={(e) => set("valorAprovadoManual", parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Ordem de Serviço</label>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] bg-white"
                value={form.ordemServicoId || ""}
                onChange={(e) => set("ordemServicoId", e.target.value || undefined)}
              >
                <option value="">Nenhuma</option>
                {ordensServico.map((os) => (
                  <option key={os.id} value={os.id}>#{os.numero} — {os.cliente}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-xs font-medium text-gray-600">Imposto</label>
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] pr-7"
                    value={form.imposto || ""}
                    onChange={(e) => set("imposto", parseFloat(e.target.value) || 0)}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">R$</span>
                </div>
                <span className="text-gray-300 text-xs">ou</span>
                <div className="flex-shrink-0 relative" style={{ width: 100 }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] pr-6"
                    value={form.percentualImposto ?? ""}
                    onChange={(e) => {
                      const pct = parseFloat(e.target.value) || 0;
                      set("percentualImposto", pct);
                      const base = form.valorAprovadoManual || 0;
                      set("imposto", base * (pct / 100));
                    }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-xs font-medium text-gray-600">Comissão</label>
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] pr-7"
                    value={form.comissao || ""}
                    onChange={(e) => set("comissao", parseFloat(e.target.value) || 0)}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">R$</span>
                </div>
                <span className="text-gray-300 text-xs">ou</span>
                <div className="flex-shrink-0 relative" style={{ width: 100 }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] pr-6"
                    value={form.percentualComissao ?? ""}
                    onChange={(e) => {
                      const pct = parseFloat(e.target.value) || 0;
                      set("percentualComissao", pct);
                      const base = form.valorAprovadoManual || 0;
                      set("comissao", base * (pct / 100));
                    }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Custo (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.custo ?? form.custosReais ?? ""}
                onChange={(e) => set("custo", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Status Nota</label>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] bg-white"
                value={form.statusNota || "Pendente"}
                onChange={(e) => set("statusNota", e.target.value as RegistroFaturamento["statusNota"])}
              >
                <option>Pendente</option>
                <option>Emitida</option>
                <option>Cancelada</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Nº Nota</label>
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.numeroNota || ""}
                onChange={(e) => set("numeroNota", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Data Emissão</label>
              <input
                type="date"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.dataEmissao || ""}
                onChange={(e) => {
                  set("dataEmissao", e.target.value);
                  if (form.diasPagamento && e.target.value) {
                    const base = new Date(e.target.value + "T12:00:00");
                    if (!isNaN(base.getTime())) {
                      base.setDate(base.getDate() + form.diasPagamento);
                      set("vencimento", base.toISOString().split("T")[0]);
                    }
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Dias Pagamento</label>
              <input
                type="number"
                min="0"
                placeholder="Ex: 20"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.diasPagamento ?? ""}
                onChange={(e) => {
                  const dias = parseInt(e.target.value, 10) || 0;
                  set("diasPagamento", dias);
                  if (dias > 0 && form.dataEmissao) {
                    const base = new Date(form.dataEmissao + "T12:00:00");
                    if (!isNaN(base.getTime())) {
                      base.setDate(base.getDate() + dias);
                      set("vencimento", base.toISOString().split("T")[0]);
                    }
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Vencimento</label>
              <input
                type="date"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.vencimento || ""}
                onChange={(e) => set("vencimento", e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-600">Pago</label>
            <button
              type="button"
              onClick={() => set("pago", !form.pago)}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${form.pago ? "bg-[#fb4d06]" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${form.pago ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            {form.pago && (
              <input
                type="date"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.dataPagamento || ""}
                onChange={(e) => set("dataPagamento", e.target.value)}
              />
            )}
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

// ── Drawer Detalhe / Edição ────────────────────────────────────────────────────
interface DrawerDetalheProps {
  row: RowUnificada;
  ordensServico: OrdemServico[];
  bancos: string[];
  onClose: () => void;
  onSalvar: (dados: Partial<RegistroFaturamento>) => Promise<void>;
}

function DrawerDetalhe({ row, ordensServico, bancos, onClose, onSalvar }: DrawerDetalheProps) {
  const diasInicial = row.fat.diasPagamento ?? extrairDiasPrazo(row.orcamento?.prazoPagamento);
  const [form, setForm] = useState<Partial<RegistroFaturamento>>({
    cliente: row.fat.cliente || row.cliente,
    job: row.fat.job || row.job,
    responsavel: row.fat.responsavel || row.responsavel,
    statusJob: row.fat.statusJob || row.statusJob,
    valorAprovadoManual: row.fat.valorAprovadoManual || (row.tipo === "manual" ? row.valorAprovado : undefined),
    custo: row.fat.custo ?? row.fat.custosReais,
    imposto: row.fat.imposto,
    percentualImposto: row.fat.percentualImposto,
    comissao: row.fat.comissao,
    percentualComissao: row.fat.percentualComissao,
    statusNota: row.fat.statusNota || "Pendente",
    numeroNota: row.fat.numeroNota,
    dataEmissao: row.fat.dataEmissao,
    diasPagamento: diasInicial,
    vencimento: row.fat.vencimento ?? (diasInicial && row.fat.dataEmissao
      ? (() => {
          const base = new Date(row.fat.dataEmissao + "T12:00:00");
          if (isNaN(base.getTime())) return undefined;
          base.setDate(base.getDate() + diasInicial);
          return base.toISOString().split("T")[0];
        })()
      : undefined),
    pago: row.fat.pago || false,
    dataPagamento: row.fat.dataPagamento,
    banco: row.fat.banco,
    modalidade: row.fat.modalidade,
    ordemServicoId: row.fat.ordemServicoId,
  });
  const [salvando, setSalvando] = useState(false);

  function set(field: keyof RegistroFaturamento, val: unknown) {
    setForm((p) => ({ ...p, [field]: val }));
  }

  async function handleSave() {
    if (form.pago && (!form.banco || !form.modalidade)) {
      alert("Selecione banco e forma de pagamento antes de marcar como pago.");
      return;
    }
    setSalvando(true);
    await onSalvar(form);
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-white shadow-2xl h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Detalhes do Lançamento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
              row.tipo === "manual"
                ? "bg-[#fb4d06]/10 text-[#fb4d06] border border-[#fb4d06]/20"
                : "bg-blue-50 text-blue-600 border border-blue-200"
            }`}>
              {row.tipo === "manual" ? "Manual" : "Orçamento"}
            </span>
            {!form.pago && row.fat.vencimento && new Date(row.fat.vencimento + "T23:59:59") < new Date() && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold border border-red-200">
                Inadimplente
              </span>
            )}
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
              form.pago ? "bg-green-50 text-green-600 border border-green-200" : "bg-yellow-50 text-yellow-600 border border-yellow-200"
            }`}>
              {form.pago ? "Pago" : "A Receber"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <ComboboxCliente
                value={form.cliente || ""}
                onChange={(v) => set("cliente", v)}
                onSelect={(c) => set("cliente", c.nomeEmpresa || c.razaoSocial)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Job</label>
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.job || ""}
                onChange={(e) => set("job", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Responsável</label>
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.responsavel || ""}
                onChange={(e) => set("responsavel", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Status do Job</label>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] bg-white"
                value={form.statusJob || ""}
                onChange={(e) => set("statusJob", e.target.value)}
              >
                <option value="">Selecione</option>
                <option>Em andamento</option>
                <option>Enviado</option>
                <option>Aprovado</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Valor Aprovado (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.valorAprovadoManual ?? ""}
                onChange={(e) => set("valorAprovadoManual", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-xs font-medium text-gray-600">Imposto</label>
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] pr-7"
                    value={form.imposto ?? ""}
                    onChange={(e) => set("imposto", parseFloat(e.target.value) || 0)}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">R$</span>
                </div>
                <span className="text-gray-300 text-xs">ou</span>
                <div className="flex-shrink-0 relative" style={{ width: 100 }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] pr-6"
                    value={form.percentualImposto ?? ""}
                    onChange={(e) => {
                      const pct = parseFloat(e.target.value) || 0;
                      set("percentualImposto", pct);
                      const base = row.valorAprovado;
                      set("imposto", base * (pct / 100));
                    }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-xs font-medium text-gray-600">Comissão</label>
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] pr-7"
                    value={form.comissao ?? ""}
                    onChange={(e) => set("comissao", parseFloat(e.target.value) || 0)}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">R$</span>
                </div>
                <span className="text-gray-300 text-xs">ou</span>
                <div className="flex-shrink-0 relative" style={{ width: 100 }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] pr-6"
                    value={form.percentualComissao ?? ""}
                    onChange={(e) => {
                      const pct = parseFloat(e.target.value) || 0;
                      set("percentualComissao", pct);
                      const base = row.valorAprovado;
                      set("comissao", base * (pct / 100));
                    }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Custo (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.custo ?? ""}
                onChange={(e) => set("custo", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Status Nota</label>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] bg-white"
                value={form.statusNota || "Pendente"}
                onChange={(e) => set("statusNota", e.target.value as RegistroFaturamento["statusNota"])}
              >
                <option>Pendente</option>
                <option>Emitida</option>
                <option>Cancelada</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Nº Nota</label>
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.numeroNota || ""}
                onChange={(e) => set("numeroNota", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Data Emissão</label>
              <input
                type="date"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.dataEmissao || ""}
                onChange={(e) => {
                  set("dataEmissao", e.target.value);
                  if (form.diasPagamento && e.target.value) {
                    const base = new Date(e.target.value + "T12:00:00");
                    if (!isNaN(base.getTime())) {
                      base.setDate(base.getDate() + form.diasPagamento);
                      set("vencimento", base.toISOString().split("T")[0]);
                    }
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Dias Pagamento</label>
              <input
                type="number"
                min="0"
                placeholder="Ex: 20"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.diasPagamento ?? ""}
                onChange={(e) => {
                  const dias = parseInt(e.target.value, 10) || 0;
                  set("diasPagamento", dias);
                  if (dias > 0 && form.dataEmissao) {
                    const base = new Date(form.dataEmissao + "T12:00:00");
                    if (!isNaN(base.getTime())) {
                      base.setDate(base.getDate() + dias);
                      set("vencimento", base.toISOString().split("T")[0]);
                    }
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Vencimento</label>
              <input
                type="date"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.vencimento || ""}
                onChange={(e) => set("vencimento", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">OS</label>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] bg-white"
                value={form.ordemServicoId || ""}
                onChange={(e) => set("ordemServicoId", e.target.value || undefined)}
              >
                <option value="">Nenhuma</option>
                {ordensServico.map((os) => (
                  <option key={os.id} value={os.id}>#{os.numero} — {os.cliente}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Pago toggle */}
          <div className="flex items-center gap-3 pt-2">
            <label className="text-xs font-medium text-gray-600">Pago</label>
            <button
              type="button"
              onClick={() => set("pago", !form.pago)}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${form.pago ? "bg-green-500" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${form.pago ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            {form.pago && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                  value={form.dataPagamento || ""}
                  onChange={(e) => set("dataPagamento", e.target.value)}
                />
                <select
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] bg-white text-gray-700"
                  value={form.modalidade || ""}
                  onChange={(e) => set("modalidade", e.target.value)}
                >
                  <option value="">Forma de pagamento...</option>
                  {MODALIDADES.map((m) => <option key={m}>{m}</option>)}
                </select>
                <select
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06] bg-white text-gray-700"
                  value={form.banco || ""}
                  onChange={(e) => set("banco", e.target.value)}
                >
                  <option value="">Banco...</option>
                  {bancos.map((b) => <option key={b}>{b}</option>)}
                </select>
                {row.tipo === "orcamento" && row.orcamento && ehCartao(form.modalidade) && (row.orcamento?.taxaCartao || 0) > 0 && (
                  <div className="w-full mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Taxa do cartão</span>
                      <span className="font-semibold text-amber-700">
                        {fmt(row.orcamento?.taxaCartao || 0)} ({calcularPercTaxaCartao(valorLiquidoOrcamento(row.orcamento), row.orcamento?.taxaCartao || 0).toFixed(2).replace(".", ",")}%)
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600 mt-1">
                      <span>Valor líquido que cai no banco</span>
                      <span className="font-semibold text-gray-800">{fmt(valorLiquidoOrcamento(row.orcamento))}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {row.tipo === "orcamento" && (
              <div className="ml-auto text-xs text-gray-400">
                Valor aprovado (orçamento): {fmt(row.valorAprovado)}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={salvando}
              className="px-4 py-2 text-sm font-medium text-white bg-[#fb4d06] rounded-lg hover:bg-[#e04400] transition disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function ContasAReceberPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [faturamentos, setFaturamentos] = useState<RegistroFaturamento[]>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [clientes, setClientes] = useState<{ nomeEmpresa?: string; razaoSocial?: string }[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState<RowUnificada | null>(null);
  const hoje = new Date();
  const [mesSel, setMesSel] = useState(hoje.getMonth());
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [showUltimos, setShowUltimos] = useState(false);
  const { user } = useUser();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [bancos, setBancos] = useState<string[]>(["C6 BANK", "Banco Itaú"]);

  const nomesClientes = useMemo(() =>
    clientes.map((c) => c.nomeEmpresa || c.razaoSocial || "").filter(Boolean),
    [clientes]
  );

  async function carregar() {
    try {
      const [resOrc, resFat, resOS, resClientes] = await Promise.all([
        fetch("/api/orcamentos"),
        fetch("/api/faturamentos"),
        fetch("/api/ordens-servico"),
        fetch("/api/clientes"),
      ]);
      const dataOrc = await resOrc.json();
      const dataFat = await resFat.json();
      const dataOS = await resOS.json();
      const dataClientes = await resClientes.json();
      setOrcamentos(Array.isArray(dataOrc) ? dataOrc : []);
      setFaturamentos(dataFat?.registros || []);
      setOrdensServico(Array.isArray(dataOS) ? dataOS : []);
      setClientes(dataClientes || []);
    } catch (err) {
      console.error("[ContasAReceber] Erro ao carregar dados:", err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then((data) => setUsuarios(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => { if (d.bancos?.length) setBancos(d.bancos); })
      .catch(() => {});
  }, []);

  // Lookup OS by orcamentoId
  const osPorOrcamentoId = useMemo(() => {
    const map: Record<string, OrdemServico> = {};
    for (const os of ordensServico) {
      if (os.orcamentoId) map[os.orcamentoId] = os;
    }
    return map;
  }, [ordensServico]);

  function navMes(dir: number) {
    let m = mesSel + dir; let a = anoSel;
    if (m < 0) { m = 11; a--; } if (m > 11) { m = 0; a++; }
    setMesSel(m); setAnoSel(a);
  }

  const rows: RowUnificada[] = useMemo(() => {
    const orcFiltrados = orcamentos.filter(
      (o) => o.status === "Enviado" || o.status === "Aprovado"
    );

    const orcRows: RowUnificada[] = orcFiltrados.map((orc) => {
      const diasPrazo = extrairDiasPrazo(orc.prazoPagamento);
      const fat = faturamentos.find((f) => f.orcamentoId === orc.id) ?? {
        statusNota: "Pendente" as const,
        pago: false,
        cliente: orc.cliente,
        job: orc.nomeProjeto || orc.numero,
        responsavel: orc.responsavel || orc.userName,
        dataEmissao: orc.dataOrcamento,
        percentualImposto: orc.percImpostos,
        percentualComissao: orc.percComissao,
        diasPagamento: diasPrazo,
        imposto: orc.percImpostos ? valorAprovadoOrcamento(orc) * (orc.percImpostos / 100) : 0,
        comissao: orc.percComissao ? valorAprovadoOrcamento(orc) * (orc.percComissao / 100) : 0,
        custo: calcCustosOrcamento(orc),
        vencimento: diasPrazo && orc.dataOrcamento ? (() => {
          const base = new Date(orc.dataOrcamento + "T12:00:00");
          if (isNaN(base.getTime())) return undefined;
          base.setDate(base.getDate() + diasPrazo);
          return base.toISOString().split("T")[0];
        })() : undefined,
      };
      return {
        rowId: `orc-${orc.id}`,
        tipo: "orcamento",
        cliente: orc.cliente || "",
        job: orc.nomeProjeto || orc.numero || "",
        responsavel: orc.responsavel || orc.userName || "",
        statusJob: orc.status,
        valorAprovado: valorAprovadoOrcamento(orc),
        custosCalculados: calcCustosOrcamento(orc),
        fat,
        orcamento: orc,
        userId: (orc as any).userId,
        userName: (orc as any).userName,
        participantes: (orc as any).participantes,
      };
    });

    const manualRows: RowUnificada[] = faturamentos
      .filter((f) => f.tipo === "manual")
      .map((fat) => ({
        rowId: `manual-${fat.id}`,
        tipo: "manual",
        cliente: fat.cliente || "",
        job: fat.job || "",
        responsavel: fat.responsavel || "",
        statusJob: fat.statusJob || "",
        valorAprovado: fat.valorAprovadoManual || 0,
        custosCalculados: fat.custosReais || 0,
        fat,
        userId: fat.userId,
        userName: fat.userName,
        participantes: fat.participantes,
      }));

    return [...orcRows, ...manualRows];
  }, [orcamentos, faturamentos]);

  // Filtra pelo mês selecionado
  const rowsMes = useMemo(() => {
    const filtradas = rows.filter((r) => {
      const ref = r.fat.vencimento || r.fat.dataEmissao;
      if (!ref) return true; // mostra se não tem data de referência
      const d = new Date(ref + "T12:00:00");
      return d.getMonth() === mesSel && d.getFullYear() === anoSel;
    });
    // Inclui orçamentos aprovados sem vencimento (prazoPagamento não preenchido)
    // pra aparecerem em qualquer mês, com destaque visual na tabela
    const semVencimento = rows.filter(
      (r) => r.tipo === "orcamento" && !r.fat.vencimento && r.orcamento?.status === "Aprovado"
    );
    return [...filtradas, ...semVencimento.filter((r) => !filtradas.find((f) => f.rowId === r.rowId))];
  }, [rows, mesSel, anoSel]);

  const kpis = useMemo(() => {
    // Orçamentos sem vencimento são incluídos no total mas não entram em inadimplente
    const totalAprovado = rowsMes.reduce((s, r) => s + r.valorAprovado, 0);
    const totalCustos = rowsMes.reduce((s, r) => s + (r.fat.imposto ?? 0) + (r.fat.comissao ?? 0) + (r.fat.custo ?? r.fat.custosReais ?? r.custosCalculados), 0);
    const aReceber = rowsMes.filter((r) => !r.fat.pago).reduce((s, r) => s + r.valorAprovado, 0);
    const recebido = rowsMes.filter((r) => r.fat.pago).reduce((s, r) => {
      // Cartão de crédito: o banco recebe o líquido (bruto − taxa) — KPI bate com o extrato
      if (ehCartao(r.fat.modalidade) && r.tipo === "orcamento" && r.orcamento && (r.orcamento.taxaCartao || 0) > 0) {
        return s + valorLiquidoOrcamento(r.orcamento);
      }
      return s + r.valorAprovado;
    }, 0);
    const inadimplente = rowsMes.filter((r) => r.fat.vencimento && statusReceber(r) === "inadimplente").reduce((s, r) => s + r.valorAprovado, 0);
    const rentabilidade = totalAprovado > 0 ? ((totalAprovado - totalCustos) / totalAprovado) * 100 : 0;
    return { totalAprovado, totalCustos, aReceber, recebido, rentabilidade, inadimplente };
  }, [rowsMes]);

  const rowsFiltradas = useMemo(() => {
    let lista = rowsMes;
    if (statusFiltro === "pago") lista = lista.filter((r) => r.fat.pago);
    else if (statusFiltro === "aReceber") lista = lista.filter((r) => !r.fat.pago && statusReceber(r) !== "inadimplente");
    else if (statusFiltro === "inadimplente") lista = lista.filter((r) => statusReceber(r) === "inadimplente");
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter((r) => r.cliente.toLowerCase().includes(q) || r.job.toLowerCase().includes(q) || (r.fat.numeroNota ?? "").toLowerCase().includes(q));
    }
    if (filtroUsuario === "meus") lista = lista.filter((r) => r.userId === user?.id);
    else if (filtroUsuario) lista = lista.filter((r) => r.userId === filtroUsuario);
    return lista;
  }, [rowsMes, statusFiltro, busca, filtroUsuario, user?.id]);

  const ultimosManuais = useMemo(() => {
    return [...faturamentos]
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 15);
  }, [faturamentos]);

  // Orçamentos aprovados que não têm prazo de pagamento (não geram vencimento)
  const orcamentosSemPrazo = useMemo(() => {
    return orcamentos.filter(
      (o) => (o.status === "Aprovado" || o.status === "Enviado") && !o.prazoPagamento
    );
  }, [orcamentos]);

  async function salvarCelula(rowId: string, field: keyof RegistroFaturamento, value: string) {
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) return;

    let body: Record<string, unknown> = {};

    if (field === "pago") {
      const vaiMarcarPago = value === "true";
      // Banco e forma de pagamento são obrigatórios para marcar como pago.
      // Se ainda não foram definidos, bloqueia o toggle e abre o drawer para escolher.
      if (vaiMarcarPago && !(row.fat.banco && row.fat.modalidade)) {
        setDetalheAberto(row);
        return;
      }
      body.pago = vaiMarcarPago;
    } else if (field === "imposto" || field === "comissao") {
      if (value.endsWith("%")) {
        const pct = parseFloat(value) || 0;
        const percentKey = field === "imposto" ? "percentualImposto" : "percentualComissao";
        body[field] = row.valorAprovado * (pct / 100);
        body[percentKey] = pct;
      } else {
        body[field] = parseFloat(value) || 0;
      }
    } else if (["valorAprovadoManual", "custosReais", "custo", "diasPagamento"].includes(field)) {
      body[field] = parseFloat(value) || 0;
    } else {
      body[field] = value;
    }

    if (row.tipo === "orcamento") body.orcamentoId = row.orcamento?.id;

    const id = row.tipo === "manual" ? row.fat.id : row.orcamento?.id;
    await fetch(`/api/faturamentos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await carregar();
  }

  async function excluirManual(rowId: string) {
    const row = rows.find((r) => r.rowId === rowId);
    if (!row || row.tipo !== "manual") return;
    await fetch(`/api/faturamentos/${row.fat.id}`, { method: "DELETE" });
    await carregar();
  }

  const mesAnoLabel = `${String(mesSel + 1).padStart(2, "0")}-${anoSel}`;

  function exportCSV() {
    const headers = ["Cliente", "Job", "Responsável", "Status Job", "Valor Aprovado", "Imposto", "Comissão", "Custo", "A Pagar", "Rentabilidade (%)", "Status Nota", "Nº Nota", "Emissão", "Vencimento", "Pago", "OS"];
    const fmtData = (d?: string) => d ? `${d.split("-")[2]}/${d.split("-")[1]}/${d.split("-")[0]}` : "";
    const rowsData = rowsFiltradas.map((r) => {
      const _imposto = r.fat.imposto ?? 0;
      const _comissao = r.fat.comissao ?? 0;
      const _custo = r.fat.custo ?? r.fat.custosReais ?? r.custosCalculados;
      const despesas = _imposto + _comissao + _custo;
      const aPagar = r.valorAprovado - despesas;
      const rentab = r.valorAprovado > 0 ? ((r.valorAprovado - despesas) / r.valorAprovado * 100) : 0;
      const os = r.fat.ordemServicoId
        ? `#${ordensServico.find((os) => os.id === r.fat.ordemServicoId)?.numero ?? ""}`
        : "";
      return [
        r.cliente,
        r.job,
        r.responsavel,
        r.statusJob,
        String(r.valorAprovado),
        String(_imposto),
        String(_comissao),
        String(_custo),
        String(aPagar),
        String(rentab.toFixed(1)),
        r.fat.statusNota ?? "",
        r.fat.numeroNota ?? "",
        fmtData(r.fat.dataEmissao),
        fmtData(r.fat.vencimento),
        r.fat.pago ? "Sim" : "Não",
        os,
      ];
    });
    downloadCSV(`contas-a-receber_${mesAnoLabel}.csv`, headers, rowsData);
  }

  async function exportPDF() {
    const linhas = rowsFiltradas.map((r) => {
      const _imposto = r.fat.imposto ?? 0;
      const _comissao = r.fat.comissao ?? 0;
      const _custo = r.fat.custo ?? r.fat.custosReais ?? r.custosCalculados;
      const despesas = _imposto + _comissao + _custo;
      const aPagar = r.valorAprovado - despesas;
      const rentab = r.valorAprovado > 0 ? ((r.valorAprovado - despesas) / r.valorAprovado * 100) : 0;
      const os = r.fat.ordemServicoId
        ? `#${ordensServico.find((os) => os.id === r.fat.ordemServicoId)?.numero ?? ""}`
        : "";
      return {
        cliente: r.cliente,
        job: r.job,
        responsavel: r.responsavel,
        statusJob: r.statusJob,
        valorAprovado: r.valorAprovado,
        imposto: _imposto,
        comissao: _comissao,
        custos: _custo,
        aPagar,
        rentabilidade: rentab,
        statusNota: r.fat.statusNota ?? "",
        numeroNota: r.fat.numeroNota ?? "",
        emissao: r.fat.dataEmissao ?? "",
        vencimento: r.fat.vencimento ?? "",
        pago: r.fat.pago ?? false,
        os,
      };
    });
    const res = await fetch("/api/financeiro/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "contas-receber",
        titulo: "Contas a Receber",
        periodo: mesAnoLabel,
        linhas,
        totalAprovado: kpis.totalAprovado,
        totalCustos: kpis.totalCustos,
        aReceber: kpis.aReceber,
        recebido: kpis.recebido,
        rentabilidadeMedia: kpis.rentabilidade,
      }),
    });
    if (!res.ok) { alert("Erro ao gerar PDF"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `contas-a-receber_${mesAnoLabel}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function salvarNovoLancamento(dados: Partial<RegistroFaturamento>) {
    await fetch("/api/faturamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dados, tipo: "manual" }),
    });
    setModalAberto(false);
    await carregar();
  }

  async function salvarEdicao(dados: Partial<RegistroFaturamento>) {
    if (!detalheAberto) return;
    const row = detalheAberto;
    const id = row.tipo === "manual" ? row.fat.id : row.orcamento?.id;
    await fetch(`/api/faturamentos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dados, ...(row.tipo === "orcamento" ? { orcamentoId: row.orcamento?.id } : {}) }),
    });
    setDetalheAberto(null);
    await carregar();
  }

  const statusNotaColor = {
    Pendente: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Emitida: "bg-green-50 text-green-700 border-green-200",
    Cancelada: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Contas a Receber</h1>
            <p className="text-gray-500 text-sm mt-1">Orçamentos enviados/aprovados e lançamentos manuais</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setShowExportMenu(p => !p)}
                className="border border-gray-200 text-gray-600 font-semibold py-2.5 px-5 rounded-xl hover:bg-gray-50 transition flex items-center gap-2 text-sm">
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
            <button
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#fb4d06] text-white text-sm font-medium rounded-xl hover:bg-[#e04400] transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Lançamento
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
              const anos = [...new Set(rows.map((r) => {
                const ref = r.fat.vencimento || r.fat.dataEmissao;
                return ref ? new Date(ref + "T12:00:00").getFullYear() : undefined;
              }).filter(Boolean))].sort() as number[];
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
          <span className="text-xs text-gray-400 ml-auto">{rowsMes.length} registro(s)</span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          {[
            { label: "Valor Aprovado", value: fmt(kpis.totalAprovado), color: "text-gray-800" },
            { label: "Custos Reais", value: fmt(kpis.totalCustos), color: "text-gray-800" },
            { label: "Rentabilidade", value: pct(kpis.rentabilidade), color: kpis.rentabilidade >= 30 ? "text-green-600" : "text-orange-500" },
            { label: "A Receber", value: fmt(kpis.aReceber), color: "text-blue-600" },
            { label: "Inadimplente", value: fmt(kpis.inadimplente), color: "text-red-600" },
            { label: "Recebido", value: fmt(kpis.recebido), color: "text-green-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {orcamentosSemPrazo.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 text-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-amber-700 font-semibold">⚠ {orcamentosSemPrazo.length} orçamento(s) aprovado(s) sem prazo de pagamento</span>
                <span className="text-gray-500 text-xs">— defina o prazo no orçamento para gerar o vencimento</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {orcamentosSemPrazo.map((o) => (
                  <a key={o.id}
                    href={`/orcamentos/${o.id}`}
                    target="_blank"
                    className="text-xs bg-white border border-amber-200 rounded-lg px-2.5 py-1 hover:bg-amber-100 transition flex items-center gap-1">
                    <span className="font-medium text-amber-800">#{o.numero}</span>
                    {o.cliente && <span className="text-gray-500">— {o.cliente}</span>}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          {/* Filtros */}
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-center">
            <input placeholder="Buscar cliente, job ou nota..."
              value={busca} onChange={(e) => setBusca(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 w-56" />
            <div className="flex gap-1">
              {(["todos", "aReceber", "pago", "inadimplente"] as const).map((s) => (
                <button key={s} onClick={() => setStatusFiltro(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize ${
                    statusFiltro === s ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}>
                  {s === "todos" ? "Todos" : s === "aReceber" ? "A Receber" : s === "pago" ? "Pago" : "Inadimplente"}
                </button>
              ))}
            </div>
            {usuarios.length > 0 && (
              <select
                value={filtroUsuario}
                onChange={(e) => setFiltroUsuario(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white max-w-[160px]"
              >
                <option value="">👤 Todos</option>
                <option value="meus">🙋 Meus registros</option>
                {usuarios.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name || u.nome || u.id}</option>
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
                title="Ver últimos registros cadastrados"
              >
                Últimos
              </button>
              {rowsFiltradas.length} registro(s)
            </span>
          </div>

          {showUltimos && (
            <div className="border-b border-gray-100 px-4 py-3 bg-gray-50/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">Últimos registros cadastrados</span>
                <button onClick={() => setShowUltimos(false)} className="text-xs text-gray-300 hover:text-gray-500 transition">Fechar</button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {ultimosManuais.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Nenhum registro encontrado.</p>
                ) : ultimosManuais.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-white text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-gray-400 font-mono text-[10px] whitespace-nowrap">
                        {f.vencimento ? (() => { const [a,m,d] = f.vencimento.split("-"); return `${d}/${m}`; })() : "--"}
                      </span>
                      <span className="text-gray-600 font-medium truncate max-w-[200px]">{f.cliente || "—"}</span>
                      <span className="text-gray-400 truncate max-w-[180px]">{f.job || (f.numeroNota ? `NF ${f.numeroNota}` : "")}</span>
                    </div>
                    <span className="font-medium whitespace-nowrap text-emerald-600">
                      R$ {(f.valorAprovadoManual || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {carregando ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Carregando...</div>
          ) : rowsFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#fb4d06]/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#fb4d06]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">Nenhum lançamento encontrado</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {["CLIENTE", "JOB", "RESPONSÁVEL", "STATUS DO JOB", "VALOR APROVADO", "IMPOSTO", "COMISSÃO", "CUSTO", "A PAGAR", "RENTABILIDADE", "STATUS NOTA", "OS", "Nº NOTA", "EMISSÃO", "VENCIMENTO", "PAGO", "CRIADO POR", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowsFiltradas.map((row) => {
                  const imposto = row.fat.imposto ?? 0;
                  const comissao = row.fat.comissao ?? 0;
                  const custo = row.fat.custo ?? row.fat.custosReais ?? row.custosCalculados;
                  const despesasTotais = imposto + comissao + custo;
                  const aPagar = row.valorAprovado - despesasTotais;
                  const rent = row.valorAprovado > 0 ? ((row.valorAprovado - despesasTotais) / row.valorAprovado) * 100 : 0;

                  return (
                    <>
                    <tr key={row.rowId} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer ${!row.fat.vencimento && row.tipo === "orcamento" && row.orcamento?.status === "Aprovado" ? "bg-amber-50/40" : ""}`} onClick={() => setDetalheAberto(row)}>
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {!row.fat.vencimento && row.tipo === "orcamento" && row.orcamento?.status === "Aprovado" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold border border-amber-200">
                              sem prazo
                            </span>
                          )}
                          {row.tipo === "manual" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#fb4d06]/10 text-[#fb4d06] font-semibold border border-[#fb4d06]/20">
                              manual
                            </span>
                          )}
                          {statusReceber(row) === "inadimplente" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold border border-red-200">
                              Inadimplente
                            </span>
                          )}
                          {row.tipo === "manual" ? (
                            <Cell value={row.cliente} mode="combobox" options={nomesClientes} onSave={(v) => salvarCelula(row.rowId, "cliente", v)} />
                          ) : (
                            <span>{row.cliente}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {row.tipo === "manual" ? (
                          <Cell value={row.job} onSave={(v) => salvarCelula(row.rowId, "job", v)} />
                        ) : (
                          <span>{row.job}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <Cell value={row.fat.responsavel ?? row.responsavel} onSave={(v) => salvarCelula(row.rowId, "responsavel", v)} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.tipo === "manual" ? (
                          <Cell
                            value={row.fat.statusJob || row.statusJob}
                            mode="select"
                            options={["Em andamento", "Enviado", "Aprovado", "Concluído"]}
                            onSave={(v) => salvarCelula(row.rowId, "statusJob", v)}
                          />
                        ) : (
                          <span className="text-gray-600">{row.statusJob}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">
                        {row.tipo === "manual" ? (
                          <Cell
                            value={row.valorAprovado.toFixed(2)}
                            mode="number"
                            onSave={(v) => salvarCelula(row.rowId, "valorAprovadoManual", v)}
                          />
                        ) : (
                          <span>{fmt(row.valorAprovado)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Cell
                            value={imposto > 0 ? imposto.toFixed(2) : ""}
                            mode="number"
                            placeholder="0,00"
                            onSave={(v) => salvarCelula(row.rowId, "imposto", v)}
                          />
                          {row.fat.percentualImposto != null && (
                            <span className="text-[10px] text-gray-400 font-medium">({row.fat.percentualImposto}%)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Cell
                            value={comissao > 0 ? comissao.toFixed(2) : ""}
                            mode="number"
                            placeholder="0,00"
                            onSave={(v) => salvarCelula(row.rowId, "comissao", v)}
                          />
                          {row.fat.percentualComissao != null && (
                            <span className="text-[10px] text-gray-400 font-medium">({row.fat.percentualComissao}%)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <Cell
                          value={custo > 0 ? custo.toFixed(2) : ""}
                          mode="number"
                          placeholder={row.custosCalculados > 0 ? `≈ ${fmt(row.custosCalculados)}` : "—"}
                          onSave={(v) => salvarCelula(row.rowId, "custo", v)}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={aPagar >= 0 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                          {fmt(aPagar)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={rent >= 30 ? "text-green-600 font-medium" : rent >= 15 ? "text-yellow-600 font-medium" : "text-red-500 font-medium"}>
                          {pct(rent)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Cell
                          value={row.fat.statusNota || "Pendente"}
                          mode="select"
                          options={["Pendente", "Emitida", "Cancelada"]}
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusNotaColor[row.fat.statusNota || "Pendente"]}`}
                          onSave={(v) => salvarCelula(row.rowId, "statusNota", v)}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.tipo === "orcamento" && osPorOrcamentoId[row.orcamento?.id || ""] ? (
                          <a
                            href={`/ordens-servico/${osPorOrcamentoId[row.orcamento!.id].id}`}
                            className="text-[#fb4d06] hover:underline font-medium text-xs"
                            target="_blank"
                          >
                            #{osPorOrcamentoId[row.orcamento!.id].numero}
                          </a>
                        ) : row.tipo === "manual" ? (
                          <Cell
                            value={row.fat.ordemServicoId
                              ? (() => { const os = ordensServico.find(o => o.id === row.fat.ordemServicoId); return os ? `#${os.numero} — ${os.cliente}` : row.fat.ordemServicoId; })()
                              : undefined}
                            mode="select"
                            options={ordensServico.map((o) => `#${o.numero} — ${o.cliente}`)}
                            placeholder="—"
                            onSave={(v) => {
                              // Extract OS id from the display string "#1234 — Cliente"
                              const match = v.match(/^#(\d+)/);
                              if (match) {
                                const os = ordensServico.find(o => o.numero === match[1]);
                                salvarCelula(row.rowId, "ordemServicoId", os?.id || "");
                              }
                            }}
                          />
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <Cell
                          value={row.fat.numeroNota}
                          placeholder="—"
                          onSave={(v) => salvarCelula(row.rowId, "numeroNota", v)}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <Cell
                          value={row.fat.dataEmissao}
                          mode="date"
                          placeholder="—"
                          onSave={(v) => salvarCelula(row.rowId, "dataEmissao", v)}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {!row.fat.vencimento && row.tipo === "orcamento" && row.orcamento?.status === "Aprovado" ? (
                          <span className="text-amber-600 text-xs font-medium flex items-center gap-1">
                            <span>⚠</span> Sem prazo
                          </span>
                        ) : (
                          <CellVencimento
                            value={row.fat.vencimento}
                            dataEmissao={row.fat.dataEmissao}
                            onSave={(v) => salvarCelula(row.rowId, "vencimento", v)}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={(e) => { e.stopPropagation(); salvarCelula(row.rowId, "pago", String(!row.fat.pago)); }}
                          className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${row.fat.pago ? "bg-green-500" : "bg-gray-200"}`}
                          title={row.fat.pago ? "Marcar como não pago" : "Marcar como pago"}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${row.fat.pago ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {row.tipo === "manual" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); excluirManual(row.rowId); }}
                            className="text-gray-300 hover:text-red-400 transition"
                            title="Excluir lançamento"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                    <tr key={`${row.rowId}-creator`} className="border-b border-gray-50">
                      <td colSpan={17} className="px-4 py-1">
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <AvatarIniciais nome={row.userName || "?"} size="sm" />
                            <span>{row.userName || "—"}</span>
                            {row.userId === user?.id && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Eu</span>}
                          </div>
                          <ParticipantesAvatar participantes={row.participantes || []} />
                        </div>
                      </td>
                    </tr>
                  </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {modalAberto && (
        <NovoLancamentoModal
          onClose={() => setModalAberto(false)}
          onSalvar={salvarNovoLancamento}
          ordensServico={ordensServico}
        />
      )}

      {detalheAberto && (
        <DrawerDetalhe
          row={detalheAberto}
          ordensServico={ordensServico}
          bancos={bancos}
          onClose={() => setDetalheAberto(null)}
          onSalvar={salvarEdicao}
        />
      )}
    </WorkspaceLayout>
  );
}

export default function PageWrapper() {
  return (
    <PageErrorBoundary>
      <ContasAReceberPage />
    </PageErrorBoundary>
  );
}
