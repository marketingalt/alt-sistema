"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import { calcularCustoTotal } from "@/lib/calculos";
import { downloadCSV } from "@/lib/export-csv";
import type { Orcamento, ItemOrcamento, OrdemServico } from "@/app/types";

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
  statusNota?: "Pendente" | "Emitida" | "Cancelada";
  numeroNota?: string;
  dataEmissao?: string;
  vencimento?: string;
  pago?: boolean;
  dataPagamento?: string;
  ordemServicoId?: string;
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
}

function calcCustosOrcamento(orc: Orcamento): number {
  return (orc.itens || []).reduce((acc: number, item: ItemOrcamento) => {
    return acc + calcularCustoTotal(item) * (item.quantidade || 0);
  }, 0);
}

function valorAprovadoOrcamento(orc: Orcamento): number {
  const subtotal = (orc.itens || []).reduce((s: number, it: ItemOrcamento) => s + (it.total || 0), 0);
  return subtotal + (orc.freteValor || 0) + (orc.custoManuseio || 0);
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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
type CellMode = "text" | "number" | "date" | "select";
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
              <label className="text-xs font-medium text-gray-600">Cliente *</label>
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.cliente || ""}
                onChange={(e) => set("cliente", e.target.value)}
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
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Custos Reais (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.custosReais || ""}
                onChange={(e) => set("custosReais", parseFloat(e.target.value) || 0)}
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
                onChange={(e) => set("dataEmissao", e.target.value)}
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
  onClose: () => void;
  onSalvar: (dados: Partial<RegistroFaturamento>) => Promise<void>;
}

function DrawerDetalhe({ row, ordensServico, onClose, onSalvar }: DrawerDetalheProps) {
  const [form, setForm] = useState<Partial<RegistroFaturamento>>({
    cliente: row.fat.cliente || row.cliente,
    job: row.fat.job || row.job,
    responsavel: row.fat.responsavel || row.responsavel,
    statusJob: row.fat.statusJob || row.statusJob,
    valorAprovadoManual: row.fat.valorAprovadoManual || (row.tipo === "manual" ? row.valorAprovado : undefined),
    custosReais: row.fat.custosReais,
    statusNota: row.fat.statusNota || "Pendente",
    numeroNota: row.fat.numeroNota,
    dataEmissao: row.fat.dataEmissao,
    vencimento: row.fat.vencimento,
    pago: row.fat.pago || false,
    dataPagamento: row.fat.dataPagamento,
    ordemServicoId: row.fat.ordemServicoId,
  });
  const [salvando, setSalvando] = useState(false);

  function set(field: keyof RegistroFaturamento, val: unknown) {
    setForm((p) => ({ ...p, [field]: val }));
  }

  async function handleSave() {
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
              <label className="text-xs font-medium text-gray-600">Cliente</label>
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.cliente || ""}
                onChange={(e) => set("cliente", e.target.value)}
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
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Custos Reais (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.custosReais ?? ""}
                onChange={(e) => set("custosReais", parseFloat(e.target.value) || 0)}
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
                onChange={(e) => set("dataEmissao", e.target.value)}
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
              <input
                type="date"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#fb4d06]"
                value={form.dataPagamento || ""}
                onChange={(e) => set("dataPagamento", e.target.value)}
              />
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
export default function ContasAReceberPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [faturamentos, setFaturamentos] = useState<RegistroFaturamento[]>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState<RowUnificada | null>(null);
  const hoje = new Date();
  const [mesSel, setMesSel] = useState(hoje.getMonth());
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  async function carregar() {
    const [resOrc, resFat, resOS] = await Promise.all([
      fetch("/api/orcamentos"),
      fetch("/api/faturamentos"),
      fetch("/api/ordens-servico"),
    ]);
    const dataOrc = await resOrc.json();
    const dataFat = await resFat.json();
    const dataOS = await resOS.json();
    setOrcamentos(dataOrc);
    setFaturamentos(dataFat.registros || []);
    setOrdensServico(Array.isArray(dataOS) ? dataOS : []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

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
      const fat = faturamentos.find((f) => f.orcamentoId === orc.id) ?? { statusNota: "Pendente" as const, pago: false };
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
      }));

    return [...orcRows, ...manualRows];
  }, [orcamentos, faturamentos]);

  // Filtra pelo mês selecionado
  const rowsMes = useMemo(() => {
    return rows.filter((r) => {
      const ref = r.fat.vencimento || r.fat.dataEmissao;
      if (!ref) return true; // mostra se não tem data de referência
      const d = new Date(ref + "T12:00:00");
      return d.getMonth() === mesSel && d.getFullYear() === anoSel;
    });
  }, [rows, mesSel, anoSel]);

  const kpis = useMemo(() => {
    const totalAprovado = rowsMes.reduce((s, r) => s + r.valorAprovado, 0);
    const totalCustos = rowsMes.reduce((s, r) => s + (r.fat.custosReais ?? r.custosCalculados), 0);
    const aReceber = rowsMes.filter((r) => !r.fat.pago).reduce((s, r) => s + r.valorAprovado, 0);
    const recebido = rowsMes.filter((r) => r.fat.pago).reduce((s, r) => s + r.valorAprovado, 0);
    const inadimplente = rowsMes.filter((r) => statusReceber(r) === "inadimplente").reduce((s, r) => s + r.valorAprovado, 0);
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
    return lista;
  }, [rowsMes, statusFiltro, busca]);

  async function salvarCelula(rowId: string, field: keyof RegistroFaturamento, value: string) {
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) return;

    let parsed: unknown = value;
    if (field === "pago") parsed = value === "true";
    if (field === "valorAprovadoManual" || field === "custosReais") parsed = parseFloat(value) || 0;
    if (field === "ordemServicoId") parsed = value;

    const id = row.tipo === "manual" ? row.fat.id : row.orcamento?.id;
    await fetch(`/api/faturamentos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: parsed, ...(row.tipo === "orcamento" ? { orcamentoId: row.orcamento?.id } : {}) }),
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
    const headers = ["Cliente", "Job", "Responsável", "Status Job", "Valor Aprovado", "Custos Reais", "A Pagar", "Rentabilidade (%)", "Status Nota", "Nº Nota", "Emissão", "Vencimento", "Pago", "OS"];
    const fmtData = (d?: string) => d ? `${d.split("-")[2]}/${d.split("-")[1]}/${d.split("-")[0]}` : "";
    const rowsData = rowsFiltradas.map((r) => {
      const aPagar = r.valorAprovado - (r.fat.custosReais ?? r.custosCalculados);
      const rentab = r.valorAprovado > 0 ? ((r.valorAprovado - (r.fat.custosReais ?? r.custosCalculados)) / r.valorAprovado * 100) : 0;
      const os = r.fat.ordemServicoId
        ? `#${ordensServico.find((os) => os.id === r.fat.ordemServicoId)?.numero ?? ""}`
        : "";
      return [
        r.cliente,
        r.job,
        r.responsavel,
        r.statusJob,
        String(r.valorAprovado),
        String(r.fat.custosReais ?? r.custosCalculados),
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
      const aPagar = r.valorAprovado - (r.fat.custosReais ?? r.custosCalculados);
      const rentab = r.valorAprovado > 0 ? ((r.valorAprovado - (r.fat.custosReais ?? r.custosCalculados)) / r.valorAprovado * 100) : 0;
      const os = r.fat.ordemServicoId
        ? `#${ordensServico.find((os) => os.id === r.fat.ordemServicoId)?.numero ?? ""}`
        : "";
      return {
        cliente: r.cliente,
        job: r.job,
        responsavel: r.responsavel,
        statusJob: r.statusJob,
        valorAprovado: r.valorAprovado,
        custos: r.fat.custosReais ?? r.custosCalculados,
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
            <button onClick={() => setAnoSel(anoSel - 1)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition text-gray-500 hover:bg-gray-100">{anoSel - 1}</button>
            <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-white">{anoSel}</button>
            <button onClick={() => setAnoSel(anoSel + 1)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition text-gray-500 hover:bg-gray-100">{anoSel + 1}</button>
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
            <span className="text-xs text-gray-400 ml-auto">{rowsFiltradas.length} registro(s)</span>
          </div>

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
                  {["CLIENTE", "JOB", "RESPONSÁVEL", "STATUS DO JOB", "VALOR APROVADO", "CUSTOS REAIS", "A PAGAR", "RENTABILIDADE", "STATUS NOTA", "OS", "Nº NOTA", "EMISSÃO", "VENCIMENTO", "PAGO", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowsFiltradas.map((row) => {
                  const custos = row.fat.custosReais ?? row.custosCalculados;
                  const aPagar = row.valorAprovado - custos;
                  const rent = row.valorAprovado > 0 ? ((row.valorAprovado - custos) / row.valorAprovado) * 100 : 0;

                  return (
                    <tr key={row.rowId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setDetalheAberto(row)}>
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                        <div className="flex items-center gap-2">
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
                            <Cell value={row.cliente} onSave={(v) => salvarCelula(row.rowId, "cliente", v)} />
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
                            options={["Em andamento", "Enviado", "Aprovado"]}
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
                        <Cell
                          value={custos > 0 ? custos.toFixed(2) : ""}
                          mode="number"
                          placeholder={row.custosCalculados > 0 ? `≈ ${fmt(row.custosCalculados)}` : "—"}
                          onSave={(v) => salvarCelula(row.rowId, "custosReais", v)}
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
                        <CellVencimento
                          value={row.fat.vencimento}
                          dataEmissao={row.fat.dataEmissao}
                          onSave={(v) => salvarCelula(row.rowId, "vencimento", v)}
                        />
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
          onClose={() => setDetalheAberto(null)}
          onSalvar={salvarEdicao}
        />
      )}
    </WorkspaceLayout>
  );
}
