"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import { Orcamento } from "@/app/types";
import { apiFetch } from "@/lib/api-fetch";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lancamento {
  id: string;
  data: string;
  valor: number;
  categoria: string;
  obs?: string;
  modalidade?: string;
  banco?: string;
  area?: string;
}

interface FluxoCaixa {
  saldoInicial: number;
  saldoInicialData: string;
  lancamentos: Lancamento[];
}

interface ContaPagar {
  id: string;
  dataVencimento: string;
  fornecedor: string;
  descricao: string;
  valor: number;
  status: "pendente" | "pago";
  categoria: string;
  area?: string;
  modalidade?: string;
}

interface RegistroFat {
  id?: string;
  orcamentoId?: string;
  tipo?: "manual" | "orcamento";
  cliente?: string;
  job?: string;
  vencimento?: string;
  pago?: boolean;
  valorAprovadoManual?: number;
  statusNota?: string;
}

type DetalheAberto = null | "fluxo" | "pagar" | "receber";
type ProvTab = "semana" | "mes" | "ano";

interface Simulacao {
  id: string;
  data: string;
  valor: number; // positive = entrada, negative = saída
  descricao: string;
}

interface TermoRow {
  data: string;
  entradasAuto: number;
  saidasAuto: number;
  simEntradas: number;
  simSaidas: number;
  diarioAuto: number;
  diarioSim: number;
  saldoAuto: number;
  saldoSim: number;
  isPast: boolean;
  sims: Simulacao[];
}

interface Sugestao {
  data: string;
  baseSaldo: number;
  saldoApos: number;
  nivel: "excelente" | "bom" | "aceitavel" | "critico";
  motivo: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtBRLOrDash(n: number): string {
  return n === 0 ? "-" : fmtBRL(n);
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function fmtDateFull(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtMonthYear(y: number, m: number): string {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[m - 1]} ${y}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function getWeekDays(weekOffset: number): string[] {
  const today = new Date();
  const dow = today.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(today);
  mon.setDate(today.getDate() + diffToMon + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

function getOrcamentoValorAprovado(o: Orcamento): number {
  const itensTotal = o.itens.reduce((s, it) => s + it.total, 0);
  return itensTotal + (o.freteValor ?? 0) + (o.custoManuseio ?? 0);
}

function saldoAteDia(saldoInicial: number, lancamentos: Lancamento[], data: string): number {
  return saldoInicial + lancamentos.filter((l) => l.data <= data).reduce((s, l) => s + l.valor, 0);
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

// ─── SparkLine ────────────────────────────────────────────────────────────────

function SparkLine({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length < 2) return <svg width={100} height={28} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 98 + 1;
      const y = 27 - ((v - min) / range) * 25;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={100} height={28} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PainelDeControlePage() {
  const today = new Date().toISOString().split("T")[0];

  const [fluxo, setFluxo] = useState<FluxoCaixa | null>(null);
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [faturamentos, setFaturamentos] = useState<RegistroFat[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [detalheAberto, setDetalheAberto] = useState<DetalheAberto>(null);
  const [categoriaDetalhe, setCategoriaDetalhe] = useState<{ titulo: string; subtitulo?: string; contas: ContaPagar[] } | null>(null);
  const [provTab, setProvTab] = useState<ProvTab>("semana");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);

  // ── Termômetro state ────────────────────────────────────────────────────────
  const [termoMesOffset, setTermoMesOffset] = useState(0);
  const [simulacoes, setSimulacoes] = useState<Simulacao[]>([]);
  const [simEditando, setSimEditando] = useState<string | null>(null);
  const [simIdEditando, setSimIdEditando] = useState<string | null>(null);
  const [simDraft, setSimDraft] = useState({ valor: "", descricao: "", tipo: "entrada" as "entrada" | "saida" });
  const [analiseValor, setAnaliseValor] = useState("");
  const [analiseTipo, setAnaliseTipo] = useState<"entrada" | "saida">("saida");
  const [sugestoesAtivas, setSugestoesAtivas] = useState(false);
  const [dreMesOffset, setDreMesOffset] = useState(0);
  const [dreTab, setDreTab] = useState<"mes" | "ano">("mes");

  useEffect(() => {
    Promise.all([
      apiFetch("/api/fluxo-caixa").then((r) => r.json()),
      apiFetch("/api/contas-a-pagar").then((r) => r.json()),
      apiFetch("/api/faturamentos").then((r) => r.json()),
      apiFetch("/api/orcamentos").then((r) => r.json()),
    ]).then(([fc, cp, fat, orc]) => {
      setFluxo(fc);
      setContas(cp.contas ?? []);
      setFaturamentos(fat.registros ?? []);
      setOrcamentos(Array.isArray(orc) ? orc : []);
    });
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────────

  const saldoAtual = useMemo(() => {
    if (!fluxo) return 0;
    return fluxo.saldoInicial + fluxo.lancamentos.reduce((s, l) => s + l.valor, 0);
  }, [fluxo]);

  const contasPendentes = useMemo(() => contas.filter((c) => c.status === "pendente"), [contas]);
  const contasVencidas = useMemo(() => contasPendentes.filter((c) => c.dataVencimento < today), [contasPendentes, today]);
  const contasProx7 = useMemo(() => contasPendentes.filter((c) => c.dataVencimento >= today && c.dataVencimento <= addDays(today, 7)), [contasPendentes, today]);

  const totalPendente = useMemo(() => contasPendentes.reduce((s, c) => s + c.valor, 0), [contasPendentes]);
  const totalVencido = useMemo(() => contasVencidas.reduce((s, c) => s + c.valor, 0), [contasVencidas]);
  const totalProx7 = useMemo(() => contasProx7.reduce((s, c) => s + c.valor, 0), [contasProx7]);

  const orcamentosRecebiveis = useMemo(
    () => orcamentos.filter((o) => o.status === "Enviado" || o.status === "Aprovado"),
    [orcamentos]
  );

  const totalAReceber = useMemo(() => {
    return orcamentosRecebiveis.reduce((s, o) => {
      const fat = faturamentos.find((f) => f.orcamentoId === o.id);
      if (fat?.pago) return s;
      return s + getOrcamentoValorAprovado(o);
    }, 0);
  }, [orcamentosRecebiveis, faturamentos]);

  const notasEmitidas = useMemo(
    () => faturamentos.filter((f) => f.statusNota && f.statusNota !== "" && f.pago !== true).length,
    [faturamentos]
  );

  const notasPendentes = useMemo(
    () => faturamentos.filter((f) => !f.statusNota || f.statusNota === "").length,
    [faturamentos]
  );

  // ── Alerts ──────────────────────────────────────────────────────────────────

  const alerts = useMemo(() => {
    const list: { level: "red" | "yellow" | "orange" | "green"; msg: string }[] = [];
    if (contasVencidas.length > 0) {
      list.push({ level: "red", msg: `${contasVencidas.length} conta(s) vencida(s) totalizando ${fmtBRL(totalVencido)}` });
    }
    if (saldoAtual < 0) {
      list.push({ level: "orange", msg: "Saldo atual negativo" });
    }
    if (saldoAtual > 0 && totalProx7 / saldoAtual > 0.5) {
      const pct = Math.round((totalProx7 / saldoAtual) * 100);
      list.push({ level: "yellow", msg: `Pagamentos dos próximos 7 dias representam ${pct}% do saldo atual` });
    }
    return list.slice(0, 3);
  }, [contasVencidas, totalVencido, saldoAtual, totalProx7]);

  // ── Fluxo sparkline ─────────────────────────────────────────────────────────

  const sparkFluxo = useMemo(() => {
    if (!fluxo) return [];
    const days = Array.from({ length: 30 }, (_, i) => addDays(today, -(29 - i)));
    return days.map((d) => saldoAteDia(fluxo.saldoInicial, fluxo.lancamentos, d));
  }, [fluxo, today]);

  const [entradasMes, saidasMes] = useMemo(() => {
    if (!fluxo) return [0, 0];
    const prefix = today.slice(0, 7);
    const mes = fluxo.lancamentos.filter((l) => l.data.startsWith(prefix));
    const ent = mes.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0);
    const sai = mes.filter((l) => l.valor < 0).reduce((s, l) => s + Math.abs(l.valor), 0);
    return [ent, sai];
  }, [fluxo, today]);

  // ── Category breakdown ──────────────────────────────────────────────────────

  const catBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    contasPendentes.forEach((c) => {
      map[c.categoria] = (map[c.categoria] ?? 0) + c.valor;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [contasPendentes]);

  // ─── Week provisioning ──────────────────────────────────────────────────────

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  const weekStart = weekDays[0];

  const weekReceberVencidos = useMemo(
    () => faturamentos.filter((f) => f.vencimento && f.vencimento < weekStart && !f.pago).reduce((s, f) => s + (f.valorAprovadoManual ?? 0), 0),
    [faturamentos, weekStart]
  );

  const weekPagarVencidos = useMemo(
    () => contasPendentes.filter((c) => c.dataVencimento < weekStart).reduce((s, c) => s + c.valor, 0),
    [contasPendentes, weekStart]
  );

  const weekReceberByDay = useMemo(
    () =>
      weekDays.map((d) =>
        faturamentos.filter((f) => f.vencimento === d && !f.pago).reduce((s, f) => s + (f.valorAprovadoManual ?? 0), 0)
      ),
    [faturamentos, weekDays]
  );

  const weekPagarByDay = useMemo(
    () => weekDays.map((d) => contasPendentes.filter((c) => c.dataVencimento === d).reduce((s, c) => s + c.valor, 0)),
    [contasPendentes, weekDays]
  );

  const pagarCatsWeek = useMemo(() => {
    const cats = new Set<string>();
    contasPendentes.forEach((c) => {
      if (c.dataVencimento >= weekStart || c.dataVencimento < weekStart) cats.add(c.categoria);
    });
    return Array.from(cats);
  }, [contasPendentes, weekStart]);

  const weekSaldos = useMemo(() => {
    if (!fluxo) return weekDays.map(() => 0);
    const dayBefore = addDays(weekStart, -1);
    let running = saldoAteDia(fluxo.saldoInicial, fluxo.lancamentos, dayBefore);
    return weekDays.map((d, i) => {
      const ent = weekReceberByDay[i];
      const sai = weekPagarByDay[i];
      running = running + ent - sai;
      return running;
    });
  }, [fluxo, weekStart, weekDays, weekReceberByDay, weekPagarByDay]);

  const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  // ─── Month provisioning ─────────────────────────────────────────────────────

  const monthYear = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  }, [monthOffset]);

  const monthDays = useMemo(() => {
    const { y, m } = monthYear;
    const total = daysInMonth(y, m);
    return Array.from({ length: total }, (_, i) => {
      const dd = String(i + 1).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      return `${y}-${mm}-${dd}`;
    });
  }, [monthYear]);

  const monthRows = useMemo(() => {
    if (!fluxo) return [];
    const { y, m } = monthYear;
    const prevLastDay = new Date(y, m - 1, 0).toISOString().split("T")[0];
    let running = saldoAteDia(fluxo.saldoInicial, fluxo.lancamentos, prevLastDay);

    return monthDays.map((iso) => {
      const isFuture = iso > today;
      let ent = 0;
      let sai = 0;
      if (!isFuture) {
        const lDay = fluxo.lancamentos.filter((l) => l.data === iso);
        ent = lDay.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0);
        sai = lDay.filter((l) => l.valor < 0).reduce((s, l) => s + Math.abs(l.valor), 0);
      } else {
        ent = faturamentos.filter((f) => f.vencimento === iso && !f.pago).reduce((s, f) => s + (f.valorAprovadoManual ?? 0), 0);
        sai = contasPendentes.filter((c) => c.dataVencimento === iso).reduce((s, c) => s + c.valor, 0);
      }
      running = running + ent - sai;
      return { iso, ent, sai, diario: ent - sai, saldo: running, isFuture };
    });
  }, [fluxo, monthYear, monthDays, today, faturamentos, contasPendentes]);

  // ─── Year provisioning ──────────────────────────────────────────────────────

  const yearValue = useMemo(() => new Date().getFullYear() + yearOffset, [yearOffset]);

  const yearRows = useMemo(() => {
    if (!fluxo) return [];
    let running = fluxo.saldoInicial + fluxo.lancamentos.filter((l) => l.data < `${yearValue}-01-01`).reduce((s, l) => s + l.valor, 0);

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const mm = String(m).padStart(2, "0");
      const prefix = `${yearValue}-${mm}`;
      const lastDayIso = `${yearValue}-${mm}-${String(daysInMonth(yearValue, m)).padStart(2, "0")}`;
      const isFuture = `${yearValue}-${mm}` > today.slice(0, 7);

      let ent = 0;
      let sai = 0;
      if (!isFuture) {
        const lMonth = fluxo.lancamentos.filter((l) => l.data.startsWith(prefix));
        ent = lMonth.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0);
        sai = lMonth.filter((l) => l.valor < 0).reduce((s, l) => s + Math.abs(l.valor), 0);
      } else {
        ent = faturamentos.filter((f) => f.vencimento?.startsWith(prefix) && !f.pago).reduce((s, f) => s + (f.valorAprovadoManual ?? 0), 0);
        sai = contasPendentes.filter((c) => c.dataVencimento.startsWith(prefix)).reduce((s, c) => s + c.valor, 0);
      }
      running = running + ent - sai;
      return { m, prefix, ent, sai, resultado: ent - sai, saldo: running, isFuture };
    });
  }, [fluxo, yearValue, today, faturamentos, contasPendentes]);

  const yearMaxAbs = useMemo(() => Math.max(...yearRows.map((r) => Math.abs(r.resultado)), 1), [yearRows]);

  // ─── Termômetro ─────────────────────────────────────────────────────────────

  const termoMes = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + termoMesOffset);
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  }, [termoMesOffset]);

  const termoRows = useMemo((): TermoRow[] => {
    if (!fluxo) return [];
    const { y, m } = termoMes;
    const mm = String(m).padStart(2, "0");
    const dias = daysInMonth(y, m);
    const prevLastDay = m === 1
      ? `${y - 1}-12-31`
      : `${y}-${String(m - 1).padStart(2, "0")}-${String(daysInMonth(y, m - 1)).padStart(2, "0")}`;
    let runningSaldoAuto = saldoAteDia(fluxo.saldoInicial, fluxo.lancamentos, prevLastDay);
    let runningSaldoSim = runningSaldoAuto;

    return Array.from({ length: dias }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      const data = `${y}-${mm}-${day}`;
      const isPast = data <= today;

      let entradasAuto = 0;
      let saidasAuto = 0;
      if (isPast) {
        const lans = fluxo.lancamentos.filter((l) => l.data === data);
        entradasAuto = lans.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0);
        saidasAuto = lans.filter((l) => l.valor < 0).reduce((s, l) => s + Math.abs(l.valor), 0);
      } else {
        entradasAuto = faturamentos.filter((f) => f.vencimento === data && !f.pago).reduce((s, f) => s + (f.valorAprovadoManual ?? 0), 0);
        saidasAuto = contasPendentes.filter((c) => c.dataVencimento === data).reduce((s, c) => s + c.valor, 0);
      }
      const daySims = simulacoes.filter((s) => s.data === data);
      const simEntradas = daySims.filter((s) => s.valor > 0).reduce((a, s) => a + s.valor, 0);
      const simSaidas = daySims.filter((s) => s.valor < 0).reduce((a, s) => a + Math.abs(s.valor), 0);
      runningSaldoAuto += entradasAuto - saidasAuto;
      runningSaldoSim += entradasAuto - saidasAuto + simEntradas - simSaidas;
      return { data, entradasAuto, saidasAuto, simEntradas, simSaidas, diarioAuto: entradasAuto - saidasAuto, diarioSim: entradasAuto - saidasAuto + simEntradas - simSaidas, saldoAuto: runningSaldoAuto, saldoSim: runningSaldoSim, isPast, sims: daySims };
    });
  }, [fluxo, termoMes, today, faturamentos, contasPendentes, simulacoes]);

  const sugestoes = useMemo((): Sugestao[] => {
    const valNum = parseFloat(analiseValor.replace(",", "."));
    if (!sugestoesAtivas || !analiseValor || isNaN(valNum) || valNum === 0 || !fluxo) return [];
    const valorEfetivo = analiseTipo === "saida" ? -Math.abs(valNum) : Math.abs(valNum);

    const candidatos: Sugestao[] = [];
    for (let i = 1; i <= 60; i++) {
      const d = addDays(today, i);
      let baseSaldo = saldoAtual;
      baseSaldo -= contasPendentes.filter((c) => c.dataVencimento > today && c.dataVencimento <= d).reduce((s, c) => s + c.valor, 0);
      baseSaldo += faturamentos.filter((f) => f.vencimento && f.vencimento > today && f.vencimento <= d && !f.pago).reduce((s, f) => s + (f.valorAprovadoManual ?? 0), 0);
      baseSaldo += simulacoes.filter((s) => s.data > today && s.data <= d).reduce((a, s) => a + s.valor, 0);
      const saldoApos = baseSaldo + valorEfetivo;
      let nivel: Sugestao["nivel"];
      let motivo: string;
      if (analiseTipo === "saida") {
        if (saldoApos < 0) continue;
        nivel = saldoApos > baseSaldo * 0.5 ? "excelente" : saldoApos > baseSaldo * 0.25 ? "bom" : "aceitavel";
        motivo = `Saldo após: ${fmtBRL(saldoApos)} — ${nivel === "excelente" ? "ampla folga" : nivel === "bom" ? "confortável" : "pouca folga"}`;
      } else {
        nivel = baseSaldo < 10000 ? "critico" : baseSaldo < 30000 ? "bom" : "aceitavel";
        motivo = `Saldo antes: ${fmtBRL(baseSaldo)} → após: ${fmtBRL(saldoApos)}`;
      }
      candidatos.push({ data: d, baseSaldo, saldoApos, nivel, motivo });
    }
    if (analiseTipo === "saida") {
      return candidatos.sort((a, b) => b.saldoApos - a.saldoApos).slice(0, 5);
    } else {
      return candidatos.sort((a, b) => a.baseSaldo - b.baseSaldo).slice(0, 5);
    }
  }, [analiseValor, analiseTipo, sugestoesAtivas, fluxo, today, saldoAtual, contasPendentes, faturamentos, simulacoes]);

  const yearRowsWithSims = useMemo(() => {
    let simCumulative = simulacoes.filter((s) => s.data < `${yearValue}-01-01`).reduce((a, s) => a + s.valor, 0);
    return yearRows.map((row) => {
      const simMes = simulacoes.filter((s) => s.data.startsWith(row.prefix)).reduce((a, s) => a + s.valor, 0);
      simCumulative += simMes;
      return { ...row, simMes, saldoSim: row.saldo + simCumulative };
    });
  }, [yearRows, yearValue, simulacoes]);

  // ─── DRE (Demonstração do Resultado) ──────────────────────────────────────────

  interface DreLinha {
    label: string;
    valor: number;
    isSubtotal: boolean;
    indentLevel: number;
    isNegativo?: boolean; // true = esse item subtrai (valor exibido como negativo mesmo sendo positivo)
  }

  interface DreAnualRow {
    label: string;
    isSubtotal: boolean;
    indentLevel: number;
    isNegativo?: boolean;
    valores: number[]; // 12 months
    total: number;
  }

  const MES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const drePeriodo = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + dreMesOffset);
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  }, [dreMesOffset]);

  // Extrai a computação das linhas DRE para reuso (prefix = "2025-01" p/ mês, "2025-" p/ ano)
  function buildDreFromPrefix(fluxo: FluxoCaixa, prefix: string): DreLinha[] {
    const lancamentosPeriodo = fluxo.lancamentos.filter((l) => l.data.startsWith(prefix));

    const catEntradas: Record<string, number> = {};
    const catSaidas: Record<string, number> = {};
    for (const l of lancamentosPeriodo) {
      const cat = l.categoria || "OUTROS";
      if (l.valor > 0) {
        catEntradas[cat] = (catEntradas[cat] || 0) + l.valor;
      } else {
        catSaidas[cat] = (catSaidas[cat] || 0) + Math.abs(l.valor);
      }
    }

    const receitaBruta = catEntradas["RECEITA OPERACIONAL BRUTA"] || 0;
    const deducoes = catSaidas["DEDUÇÕES DA RECEITA (IMPOSTOS)"] || 0;
    const receitaLiquida = receitaBruta - deducoes;

    const custosDiretos = catSaidas["CUSTOS DIRETOS DOS SERVIÇOS"] || 0;
    const lucroBruto = receitaLiquida - custosDiretos;

    const despAdm = catSaidas["DESPESAS ADM E GERAIS"] || 0;
    const despPessoal = catSaidas["DESPESAS COM PESSOAL OPERACIONAL"] || 0;
    const despProlabore = catSaidas["DESPESAS COM PESSOAL — PROLABORE"] || 0;
    const despComerciais = catSaidas["DESPESAS COMERCIAIS"] || 0;
    const despBrindes = catSaidas["BRINDES"] || 0;
    const totalDespesas = despAdm + despPessoal + despProlabore + despComerciais + despBrindes;

    const recFinanceira = catEntradas["RESULTADO FINANCEIRO"] || 0;
    const despFinanceira = catSaidas["RESULTADO FINANCEIRO"] || 0;

    const empThiemyEnt = catEntradas["EMPRÉSTIMO THIEMY"] || 0;
    const empThiemySai = catSaidas["EMPRÉSTIMO THIEMY"] || 0;
    const empFernandoEnt = catEntradas["EMPRÉSTIMO FERNANDO"] || 0;
    const empFernandoSai = catSaidas["EMPRÉSTIMO FERNANDO"] || 0;
    const devThiemy = catSaidas["DEVOLUÇÃO THIEMY"] || 0;
    const devFernando = catSaidas["DEVOLUÇÃO FERNANDO"] || 0;

    const outrasEntradas = Object.entries(catEntradas)
      .filter(([cat]) => !["RECEITA OPERACIONAL BRUTA", "RESULTADO FINANCEIRO", "EMPRÉSTIMO THIEMY", "EMPRÉSTIMO FERNANDO", "DISTRIBUIÇÃO DE LUCROS"].includes(cat))
      .reduce((s, [, v]) => s + v, 0);
    const outrasSaidas = Object.entries(catSaidas)
      .filter(([cat]) => !["DEDUÇÕES DA RECEITA (IMPOSTOS)", "CUSTOS DIRETOS DOS SERVIÇOS", "DESPESAS ADM E GERAIS", "DESPESAS COM PESSOAL OPERACIONAL", "DESPESAS COM PESSOAL — PROLABORE", "DESPESAS COMERCIAIS", "BRINDES", "RESULTADO FINANCEIRO", "EMPRÉSTIMO THIEMY", "EMPRÉSTIMO FERNANDO", "DEVOLUÇÃO THIEMY", "DEVOLUÇÃO FERNANDO", "ESTORNO", "DISTRIBUIÇÃO DE LUCROS"].includes(cat))
      .reduce((s, [, v]) => s + v, 0);

    const resultadoOperacional = lucroBruto - totalDespesas;
    const resultadoFinanceiro = recFinanceira - despFinanceira;
    const resultadoAntesExtra = resultadoOperacional + resultadoFinanceiro;
    const resultadoExtra = (empThiemyEnt + empFernandoEnt) - (empThiemySai + empFernandoSai + devThiemy + devFernando);
    const resultadoLiquido = resultadoAntesExtra + resultadoExtra;

    const linhas: DreLinha[] = [];

    linhas.push({ label: "RECEITA OPERACIONAL BRUTA", valor: receitaBruta, isSubtotal: false, indentLevel: 0 });
    linhas.push({ label: "(-) DEDUÇÕES DA RECEITA (IMPOSTOS)", valor: deducoes, isSubtotal: false, indentLevel: 0, isNegativo: true });
    linhas.push({ label: "= RECEITA OPERACIONAL LÍQUIDA", valor: receitaLiquida, isSubtotal: true, indentLevel: 0 });
    linhas.push({ label: "", valor: 0, isSubtotal: false, indentLevel: 0 });

    linhas.push({ label: "(-) CUSTOS DIRETOS DOS SERVIÇOS", valor: custosDiretos, isSubtotal: false, indentLevel: 0, isNegativo: true });
    linhas.push({ label: "= LUCRO BRUTO", valor: lucroBruto, isSubtotal: true, indentLevel: 0 });
    linhas.push({ label: "", valor: 0, isSubtotal: false, indentLevel: 0 });

    linhas.push({ label: "DESPESAS OPERACIONAIS", valor: 0, isSubtotal: false, indentLevel: 0 });

    const despItems: { label: string; val: number }[] = [
      { label: "Administrativas e Gerais", val: despAdm },
      { label: "Pessoal Operacional", val: despPessoal },
      { label: "Pró-Labore", val: despProlabore },
      { label: "Comerciais", val: despComerciais },
    ];
    if (despBrindes > 0) despItems.push({ label: "Brindes", val: despBrindes });
    for (const item of despItems) {
      if (item.val > 0) linhas.push({ label: `  • ${item.label}`, valor: item.val, isSubtotal: false, indentLevel: 1, isNegativo: true });
    }
    linhas.push({ label: "  (-) Total Despesas Operacionais", valor: totalDespesas, isSubtotal: true, indentLevel: 1, isNegativo: true });
    linhas.push({ label: "", valor: 0, isSubtotal: false, indentLevel: 0 });

    linhas.push({ label: "= RESULTADO OPERACIONAL", valor: resultadoOperacional, isSubtotal: true, indentLevel: 0 });
    linhas.push({ label: "", valor: 0, isSubtotal: false, indentLevel: 0 });

    linhas.push({ label: "RESULTADO FINANCEIRO", valor: resultadoFinanceiro, isSubtotal: false, indentLevel: 0 });
    if (recFinanceira > 0) linhas.push({ label: `  • Receitas Financeiras`, valor: recFinanceira, isSubtotal: false, indentLevel: 1 });
    if (despFinanceira > 0) linhas.push({ label: `  • Despesas Financeiras`, valor: despFinanceira, isSubtotal: false, indentLevel: 1, isNegativo: true });
    if (outrasEntradas > 0 || outrasSaidas > 0) {
      linhas.push({ label: "OUTRAS RECEITAS/DESPESAS", valor: outrasEntradas - outrasSaidas, isSubtotal: false, indentLevel: 0 });
    }
    linhas.push({ label: "", valor: 0, isSubtotal: false, indentLevel: 0 });

    linhas.push({ label: "EMPRÉSTIMOS / DEVOLUÇÕES", valor: resultadoExtra, isSubtotal: false, indentLevel: 0 });
    if (empThiemySai + devThiemy > 0) linhas.push({ label: `  • Empréstimos/Devoluções Thiemy`, valor: empThiemySai + devThiemy, isSubtotal: false, indentLevel: 1, isNegativo: true });
    if (empFernandoSai + devFernando > 0) linhas.push({ label: `  • Empréstimos/Devoluções Fernando`, valor: empFernandoSai + devFernando, isSubtotal: false, indentLevel: 1, isNegativo: true });
    if (empThiemyEnt > 0) linhas.push({ label: `  • Aportes Thiemy`, valor: empThiemyEnt, isSubtotal: false, indentLevel: 1 });
    if (empFernandoEnt > 0) linhas.push({ label: `  • Aportes Fernando`, valor: empFernandoEnt, isSubtotal: false, indentLevel: 1 });
    linhas.push({ label: "", valor: 0, isSubtotal: false, indentLevel: 0 });

    linhas.push({ label: "= RESULTADO LÍQUIDO DO PERÍODO", valor: resultadoLiquido, isSubtotal: true, indentLevel: 0 });

    return linhas;
  }

  const dreLinhas = useMemo((): DreLinha[] => {
    if (!fluxo) return [];
    const { y, m } = drePeriodo;
    const mm = String(m).padStart(2, "0");
    const prefix = dreTab === "mes" ? `${y}-${mm}` : `${y}-`;
    return buildDreFromPrefix(fluxo, prefix);
  }, [fluxo, drePeriodo, dreTab]);

  // DRE anual mês a mês — apenas quando dreTab === "ano"
  const dreAnualRows = useMemo((): DreAnualRow[] => {
    if (!fluxo || dreTab !== "ano") return [];
    const year = drePeriodo.y;

    // Computa DRE para cada mês
    const mesesDre = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const mm = String(m).padStart(2, "0");
      return buildDreFromPrefix(fluxo, `${year}-${mm}`);
    });

    // Constrói lista mestra de labels na ordem de aparecimento
    const labelSet = new Set<string>();
    for (const mes of mesesDre) {
      for (const linha of mes) {
        if (!labelSet.has(linha.label)) {
          labelSet.add(linha.label);
        }
      }
    }
    // Preserva ordem de aparecimento percorrendo todos meses
    const ordem: string[] = [];
    const seen = new Set<string>();
    for (const mes of mesesDre) {
      for (const linha of mes) {
        if (!seen.has(linha.label)) {
          seen.add(linha.label);
          ordem.push(linha.label);
        }
      }
    }

    return ordem.map((label) => {
      // Pega template do primeiro mês que tem essa label
      let template: DreLinha | undefined;
      for (const mes of mesesDre) {
        const match = mes.find((l) => l.label === label);
        if (match) { template = match; break; }
      }
      if (!template) return null;

      const valores = mesesDre.map((mes) => {
        const match = mes.find((l) => l.label === label);
        if (!match) return 0;
        return match.isNegativo ? -match.valor : match.valor;
      });
      const total = valores.reduce((a, b) => a + b, 0);

      return { label, isSubtotal: template.isSubtotal, indentLevel: template.indentLevel, isNegativo: template.isNegativo, valores, total };
    }).filter(Boolean) as DreAnualRow[];
  }, [fluxo, drePeriodo, dreTab]);

  // ─── Fluxo detail: grouped by month ─────────────────────────────────────────

  const fluxoGrouped = useMemo(() => {
    if (!fluxo) return [];
    const sorted = [...fluxo.lancamentos].sort((a, b) => b.data.localeCompare(a.data));
    const groups: { month: string; rows: (Lancamento & { saldoAcum: number })[] }[] = [];
    const seen = new Set<string>();
    sorted.forEach((l) => {
      const month = l.data.slice(0, 7);
      if (!seen.has(month)) {
        seen.add(month);
        groups.push({ month, rows: [] });
      }
      const g = groups.find((g) => g.month === month)!;
      const saldoAcum = saldoAteDia(fluxo.saldoInicial, fluxo.lancamentos, l.data);
      g.rows.push({ ...l, saldoAcum });
    });
    return groups;
  }, [fluxo]);

  const loading = !fluxo;

  // ─── Export DRE: PDF ────────────────────────────────────────────────────────
  const exportarDRE_PDF = useCallback(() => {
    const { y, m } = drePeriodo;
    const periodoLabel = dreTab === "mes"
      ? new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : String(y);

    const linhaRow = (item: DreLinha) => {
      if (!item.label) return `<tr style="height:8px"><td colspan="2"></td></tr>`;
      const val = item.isNegativo ? -item.valor : item.valor;
      const prefix = item.indentLevel > 0 ? "&nbsp;&nbsp;" : "";
      const subClass = item.isSubtotal ? ' style="font-weight:700;background:#f9fafb;"' : "";
      const valClass = val >= 0 ? "color:#059669" : "color:#dc2626";
      return `<tr${subClass}><td style="padding:4px 12px;font-size:12px;${item.isSubtotal ? "font-weight:700" : ""}">${prefix}${item.label}</td><td style="padding:4px 12px;text-align:right;font-size:12px;${valClass}">${val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td></tr>`;
    };

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>DRE - ${periodoLabel}</title>
<style>
  body { font-family: 'Courier New', monospace; padding: 40px; color: #333; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .sub { font-size: 12px; color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  td { border-bottom: 1px solid #eee; }
  .footer { margin-top: 20px; font-size: 10px; color: #999; }
</style></head><body>
<h1>DRE — Demonstração do Resultado</h1>
<p class="sub">${periodoLabel} | Gerado em ${new Date().toLocaleString("pt-BR")}</p>
<table>`;
    html += dreLinhas.map(linhaRow).join("\n");
    html += `</table><p class="footer">* DRE calculada com base nos lançamentos do Fluxo de Caixa agrupados por categoria.</p></body></html>`;

    const win = window.open("", "_blank");
    if (!win) { alert("Permita pop-ups para baixar o PDF."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }, [dreLinhas, drePeriodo, dreTab]);

  // ─── Export DRE: Planilha CSV ───────────────────────────────────────────────
  const exportarDRE_CSV = useCallback(() => {
    const { y, m } = drePeriodo;
    const periodoLabel = dreTab === "mes"
      ? new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : String(y);

    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;

    let csv = "﻿"; // BOM for Excel
    csv += `DRE - Demonstração do Resultado\n`;
    csv += `Período,${esc(periodoLabel)}\n`;
    csv += `Gerado em,${esc(new Date().toLocaleString("pt-BR"))}\n`;
    csv += `\n`;
    csv += `Descrição,Valor (R$)\n`;

    for (const linha of dreLinhas) {
      if (!linha.label) { csv += "\n"; continue; }
      const val = linha.isNegativo ? -linha.valor : linha.valor;
      const prefixo = linha.indentLevel > 0 ? "  " : "";
      csv += `${esc(prefixo + linha.label)},${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
    }

    csv += `\n* DRE calculada com base nos lançamentos do Fluxo de Caixa agrupados por categoria.\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DRE_${dreTab}_${drePeriodo.y}${dreTab === "mes" ? `_${String(drePeriodo.m).padStart(2, "0")}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [dreLinhas, drePeriodo, dreTab]);

  // ─── Export DRE Anual: Planilha CSV ──────────────────────────────────────────
  const exportarDREAnual_CSV = useCallback(() => {
    const year = drePeriodo.y;
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;

    let csv = "﻿";
    csv += `DRE - Demonstração do Resultado - ${year}\n`;
    csv += `Gerado em,${esc(new Date().toLocaleString("pt-BR"))}\n\n`;

    // Header: labels dos meses
    csv += `Descrição,${MES_LABELS.map((l) => esc(l)).join(",")},Total\n`;

    for (const row of dreAnualRows) {
      if (!row.label) { csv += "\n"; continue; }
      const prefixo = row.indentLevel > 0 ? "  " : "";
      const valores = row.valores.map((v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
      csv += `${esc(prefixo + row.label)},${valores.join(",")},${row.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DRE_Anual_${year}_detalhado.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [dreAnualRows, drePeriodo]);

  // ─── Estado do menu de export ────────────────────────────────────────────────
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [exportMenuOpen]);

  // ─── JSX ─────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <WorkspaceLayout>
        <main className="px-6 py-6 max-w-7xl">
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando painel...</div>
        </main>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout>
      <main className="px-6 py-6 max-w-7xl">

        {/* ── Header ── */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Painel de Controle</h1>
            <p className="text-gray-500 text-sm mt-0.5">Visão consolidada de todas as áreas financeiras.</p>
          </div>
          <span className="text-sm text-gray-400 mt-1">{fmtDateFull(today)}</span>
        </div>

        {/* ── Alert Bar ── */}
        <div className="mb-6 flex flex-col gap-2">
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm font-medium">
              <span className="text-base">🟢</span> Todas as métricas estão saudáveis
            </div>
          ) : (
            alerts.map((a, i) => {
              const styles = {
                red: "bg-red-50 border-red-200 text-red-800",
                yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
                orange: "bg-orange-50 border-orange-200 text-orange-800",
                green: "bg-green-50 border-green-200 text-green-800",
              }[a.level];
              const emoji = { red: "🔴", yellow: "🟡", orange: "🟠", green: "🟢" }[a.level];
              return (
                <div key={i} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium ${styles}`}>
                  <span className="text-base">{emoji}</span> {a.msg}
                </div>
              );
            })
          )}
        </div>

        {/* ── Module Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

          {/* Fluxo de Caixa */}
          <div
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow flex flex-col gap-3"
            onClick={() => setDetalheAberto("fluxo")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#fb4d06]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#fb4d06]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-700">Fluxo de Caixa</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${saldoAtual >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {saldoAtual >= 0 ? "Positivo" : "Negativo"}
              </span>
            </div>
            <div>
              <div className={`text-2xl font-bold ${saldoAtual >= 0 ? "text-gray-900" : "text-red-600"}`}>{fmtBRL(saldoAtual)}</div>
              <div className="text-xs text-gray-400 mt-0.5">Saldo atual</div>
            </div>
            <SparkLine values={sparkFluxo} stroke={saldoAtual >= 0 ? "#16a34a" : "#dc2626"} />
            <div className="flex gap-4 text-xs text-gray-500">
              <span>↑ {fmtBRL(entradasMes)} entradas</span>
              <span>↓ {fmtBRL(saidasMes)} saídas</span>
            </div>
            <div className="text-xs text-[#fb4d06] font-medium mt-auto">Ver detalhes →</div>
          </div>

          {/* Contas a Pagar */}
          <div
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow flex flex-col gap-3"
            onClick={() => setDetalheAberto("pagar")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-700">Contas a Pagar</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${contasVencidas.length > 0 ? "bg-red-100 text-red-700" : totalProx7 > saldoAtual * 0.3 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                {contasVencidas.length > 0 ? `${contasVencidas.length} vencida(s)` : totalProx7 > saldoAtual * 0.3 ? "Atenção" : "OK"}
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{fmtBRL(totalPendente)}</div>
              <div className="text-xs text-gray-400 mt-0.5">Total pendente</div>
            </div>
            <div className="flex flex-col gap-1.5">
              {catBreakdown.map(([cat, val]) => (
                <div key={cat} className="flex items-center gap-2">
                  <div className="text-xs text-gray-500 w-24 truncate">{cat}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-[#fb4d06] h-1.5 rounded-full"
                      style={{ width: `${totalPendente > 0 ? (val / totalPendente) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 w-12 text-right">{totalPendente > 0 ? Math.round((val / totalPendente) * 100) : 0}%</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-500">Vencidas: <span className="text-red-600 font-medium">{fmtBRL(totalVencido)}</span></div>
            <div className="text-xs text-[#fb4d06] font-medium mt-auto">Ver detalhes →</div>
          </div>

          {/* Contas a Receber */}
          <div
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow flex flex-col gap-3"
            onClick={() => setDetalheAberto("receber")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-700">Contas a Receber</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${notasEmitidas > 0 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                {notasEmitidas > 0 ? "Notas emitidas" : "Pendente"}
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{fmtBRL(totalAReceber)}</div>
              <div className="text-xs text-gray-400 mt-0.5">Total a receber</div>
            </div>
            <div className="flex gap-4 text-xs text-gray-500 mt-1">
              <span className="text-green-700 font-medium">{notasEmitidas} nota(s) emitida(s)</span>
              <span className="text-yellow-700 font-medium">{notasPendentes} sem nota</span>
            </div>
            <div className="text-xs text-[#fb4d06] font-medium mt-auto">Ver detalhes →</div>
          </div>

        </div>

        {/* ── Provisionamento ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">Provisionamento</h2>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              {(["semana", "mes", "ano"] as ProvTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setProvTab(tab)}
                  className={`px-4 py-1.5 font-medium transition-colors ${provTab === tab ? "bg-[#fb4d06] text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  {tab === "semana" ? "Semana" : tab === "mes" ? "Mês" : "Ano"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Semana ── */}
          {provTab === "semana" && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setWeekOffset((p) => p - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">‹</button>
                <span className="text-sm font-medium text-gray-700">
                  {fmtDateFull(weekDays[0])} – {fmtDateFull(weekDays[6])}
                </span>
                <button onClick={() => setWeekOffset((p) => p + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">›</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 w-36">STATUS</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500">VENCIDOS</th>
                      {weekDays.map((d, i) => (
                        <th key={d} className={`text-right px-3 py-2 font-semibold text-gray-500 ${d === today ? "bg-[#fb4d06]/5 text-[#fb4d06]" : ""}`}>
                          {DAY_LABELS[i]}<br />{fmtDate(d)}
                        </th>
                      ))}
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* A Receber */}
                    <tr className="bg-green-50 border-b border-green-100">
                      <td className="px-3 py-2 font-semibold text-green-800">TOTAL A RECEBER</td>
                      <td className="text-right px-3 py-2 text-green-700 font-medium">{fmtBRLOrDash(weekReceberVencidos)}</td>
                      {weekReceberByDay.map((v, i) => (
                        <td key={i} className="text-right px-3 py-2 text-green-700">{fmtBRLOrDash(v)}</td>
                      ))}
                      <td className="text-right px-3 py-2 font-bold text-green-800">
                        {fmtBRLOrDash(weekReceberVencidos + weekReceberByDay.reduce((s, v) => s + v, 0))}
                      </td>
                    </tr>
                    {/* A Pagar */}
                    {(() => {
                      const allVencidas = contasPendentes.filter((c) => c.dataVencimento < weekStart);
                      const totalPagarVenc = allVencidas.reduce((s, c) => s + c.valor, 0);
                      const totalGeral = weekPagarVencidos + weekPagarByDay.reduce((s, v) => s + v, 0);
                      function cellBtn(contas: ContaPagar[], label: string, val: number, cls: string) {
                        if (val === 0) return <td className={`text-right px-3 py-2 ${cls}`}>—</td>;
                        return (
                          <td className={`text-right px-3 py-2 ${cls}`}>
                            <button onClick={() => setCategoriaDetalhe({ titulo: "Total a Pagar", subtitulo: label, contas })}
                              className="hover:underline hover:text-[#fb4d06] transition-colors cursor-pointer font-medium">
                              {fmtBRL(val)}
                            </button>
                          </td>
                        );
                      }
                      return (
                        <tr className="bg-red-50 border-b border-red-100">
                          <td className="px-3 py-2 font-semibold text-red-800">TOTAL A PAGAR</td>
                          {cellBtn(allVencidas, "Vencidas", totalPagarVenc, "text-red-700 font-medium")}
                          {weekPagarByDay.map((v, i) => {
                            const dayContas = contasPendentes.filter((c) => c.dataVencimento === weekDays[i]);
                            return cellBtn(dayContas, fmtDateFull(weekDays[i]), v, "text-red-700");
                          })}
                          {cellBtn(
                            contasPendentes.filter((c) => c.dataVencimento < weekDays[7 - 1 + 1] || c.dataVencimento < weekStart ? c.dataVencimento < weekStart : c.dataVencimento <= weekDays[6]),
                            "Semana completa",
                            totalGeral,
                            "text-red-800 font-bold"
                          )}
                        </tr>
                      );
                    })()}
                    {/* Category sub-rows */}
                    {pagarCatsWeek.map((cat) => {
                      const catContas = contasPendentes.filter((c) => c.categoria === cat);
                      const vencidas = catContas.filter((c) => c.dataVencimento < weekStart);
                      const venc = vencidas.reduce((s, c) => s + c.valor, 0);
                      const byDay = weekDays.map((d) => catContas.filter((c) => c.dataVencimento === d));
                      const byDayVal = byDay.map((cs) => cs.reduce((s, c) => s + c.valor, 0));
                      const total = venc + byDayVal.reduce((s, v) => s + v, 0);
                      if (total === 0) return null;

                      function valCell(contas: ContaPagar[], val: number, label: string, cls = "") {
                        if (val === 0) return <td className={`text-right px-3 py-1.5 text-gray-300 ${cls}`}>—</td>;
                        return (
                          <td className={`text-right px-3 py-1.5 ${cls}`}>
                            <button onClick={() => setCategoriaDetalhe({ titulo: cat, subtitulo: label, contas })}
                              className="hover:underline hover:text-[#fb4d06] transition-colors cursor-pointer">
                              {fmtBRL(val)}
                            </button>
                          </td>
                        );
                      }

                      return (
                        <tr key={cat} className="bg-red-50/50 border-b border-red-50 text-gray-500">
                          <td className="px-3 py-1.5 pl-7 whitespace-normal">
                            <button
                              onClick={() => setCategoriaDetalhe({ titulo: cat, contas: catContas })}
                              className="italic text-gray-500 hover:text-[#fb4d06] hover:underline text-left transition-colors"
                            >
                              {cat}
                            </button>
                          </td>
                          {valCell(vencidas, venc, "Vencidas")}
                          {byDay.map((cs, i) => valCell(cs, byDayVal[i], fmtDateFull(weekDays[i])))}
                          {valCell(catContas, total, "Total da categoria", "font-medium")}
                        </tr>
                      );
                    })}
                    {/* Saldos */}
                    <tr className="border-t-2 border-gray-200 bg-white">
                      <td className="px-3 py-2 font-bold text-gray-800">SALDOS</td>
                      <td className="px-3 py-2" />
                      {weekSaldos.map((s, i) => (
                        <td key={i} className={`text-right px-3 py-2 font-bold ${s >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {fmtBRL(s)}
                        </td>
                      ))}
                      <td className={`text-right px-3 py-2 font-bold ${weekSaldos[6] >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {fmtBRL(weekSaldos[6] ?? 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Mês ── */}
          {provTab === "mes" && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setMonthOffset((p) => p - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">‹</button>
                <span className="text-sm font-medium text-gray-700">{fmtMonthYear(monthYear.y, monthYear.m)}</span>
                <button onClick={() => setMonthOffset((p) => p + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">›</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">DIA</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">ENTRADAS</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">SAÍDAS</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">DIÁRIO</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">SALDO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthRows.map((row) => {
                      const isZero = row.ent === 0 && row.sai === 0;
                      const [,, dd] = row.iso.split("-");
                      return (
                        <tr
                          key={row.iso}
                          className={`border-b border-gray-50 ${row.iso === today ? "bg-[#fb4d06]/5" : row.isFuture ? "opacity-60" : ""} ${isZero ? "text-gray-300" : "text-gray-700"}`}
                        >
                          <td className="px-3 py-1.5 font-medium">
                            {dd}/{String(monthYear.m).padStart(2, "0")}
                            {row.isFuture && <span className="ml-1.5 text-[10px] italic text-gray-400">projetado</span>}
                          </td>
                          <td className="text-right px-3 py-1.5 text-green-600">{fmtBRLOrDash(row.ent)}</td>
                          <td className="text-right px-3 py-1.5 text-red-500">{fmtBRLOrDash(row.sai)}</td>
                          <td className={`text-right px-3 py-1.5 font-medium ${row.diario > 0 ? "text-green-700" : row.diario < 0 ? "text-red-600" : "text-gray-300"}`}>
                            {fmtBRLOrDash(row.diario)}
                          </td>
                          <td className={`text-right px-3 py-1.5 font-semibold ${row.saldo >= 0 ? "text-gray-800" : "text-red-600"}`}>
                            {fmtBRL(row.saldo)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-800">
                      <td className="px-3 py-2">Total</td>
                      <td className="text-right px-3 py-2 text-green-700">{fmtBRL(monthRows.reduce((s, r) => s + r.ent, 0))}</td>
                      <td className="text-right px-3 py-2 text-red-600">{fmtBRL(monthRows.reduce((s, r) => s + r.sai, 0))}</td>
                      <td className={`text-right px-3 py-2 ${monthRows.reduce((s, r) => s + r.diario, 0) >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {fmtBRL(monthRows.reduce((s, r) => s + r.diario, 0))}
                      </td>
                      <td className={`text-right px-3 py-2 ${(monthRows[monthRows.length - 1]?.saldo ?? 0) >= 0 ? "text-gray-900" : "text-red-600"}`}>
                        {fmtBRL(monthRows[monthRows.length - 1]?.saldo ?? 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── Ano ── */}
          {provTab === "ano" && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setYearOffset((p) => p - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">‹</button>
                <span className="text-sm font-medium text-gray-700">{yearValue}</span>
                <button onClick={() => setYearOffset((p) => p + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">›</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse mb-4">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">MÊS</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">ENTRADAS</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">SAÍDAS</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">RESULTADO</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">SALDO ACUMULADO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearRows.map((row) => (
                      <tr key={row.m} className={`border-b border-gray-50 ${row.isFuture ? "opacity-60 italic" : ""}`}>
                        <td className="px-3 py-2 font-medium text-gray-700">{fmtMonthYear(yearValue, row.m)}</td>
                        <td className="text-right px-3 py-2 text-green-600">{fmtBRLOrDash(row.ent)}</td>
                        <td className="text-right px-3 py-2 text-red-500">{fmtBRLOrDash(row.sai)}</td>
                        <td className={`text-right px-3 py-2 font-semibold ${row.resultado > 0 ? "text-green-700" : row.resultado < 0 ? "text-red-600" : "text-gray-400"}`}>
                          {fmtBRLOrDash(row.resultado)}
                        </td>
                        <td className={`text-right px-3 py-2 font-semibold ${row.saldo >= 0 ? "text-gray-800" : "text-red-600"}`}>
                          {fmtBRL(row.saldo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-800">
                      <td className="px-3 py-2">Total</td>
                      <td className="text-right px-3 py-2 text-green-700">{fmtBRL(yearRows.reduce((s, r) => s + r.ent, 0))}</td>
                      <td className="text-right px-3 py-2 text-red-600">{fmtBRL(yearRows.reduce((s, r) => s + r.sai, 0))}</td>
                      <td className={`text-right px-3 py-2 ${yearRows.reduce((s, r) => s + r.resultado, 0) >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {fmtBRL(yearRows.reduce((s, r) => s + r.resultado, 0))}
                      </td>
                      <td className={`text-right px-3 py-2 ${(yearRows[11]?.saldo ?? 0) >= 0 ? "text-gray-900" : "text-red-600"}`}>
                        {fmtBRL(yearRows[11]?.saldo ?? 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                {/* Mini bar chart */}
                <div className="flex items-end gap-1 h-16 px-3">
                  {yearRows.map((row) => {
                    const pct = (Math.abs(row.resultado) / yearMaxAbs) * 100;
                    return (
                      <div key={row.m} className="flex-1 flex flex-col items-center justify-end gap-0.5" title={fmtMonthYear(yearValue, row.m)}>
                        <div
                          className={`w-full rounded-sm ${row.resultado >= 0 ? "bg-green-400" : "bg-red-400"} ${row.isFuture ? "opacity-50" : ""}`}
                          style={{ height: `${Math.max(pct, 2)}%` }}
                        />
                        <span className="text-[9px] text-gray-400">{["J","F","M","A","M","J","J","A","S","O","N","D"][row.m - 1]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ══ DRE — DEMONSTRAÇÃO DO RESULTADO ═════════════════════════════════ */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">DRE — Demonstração do Resultado</h2>
                <p className="text-xs text-gray-500 mt-0.5">Receitas, custos, despesas e resultado líquido do período</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                {(["mes", "ano"] as const).map((tab) => (
                  <button key={tab} onClick={() => setDreTab(tab)}
                    className={`px-3 py-1.5 font-medium transition ${dreTab === tab ? "bg-[#fb4d06] text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                    {tab === "mes" ? "Mês" : "Ano"}
                  </button>
                ))}
              </div>
              <button onClick={() => setDreMesOffset((p) => p - 1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition text-sm">‹</button>
              <span className="text-sm font-semibold text-gray-800 min-w-[100px] text-center">
                {dreTab === "mes"
                  ? new Date(drePeriodo.y, drePeriodo.m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
                  : String(drePeriodo.y)}
              </span>
              <button onClick={() => setDreMesOffset((p) => p + 1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition text-sm">›</button>
              {/* Dropdown de exportação */}
              <div className="relative" ref={exportMenuRef as React.RefObject<HTMLDivElement | null>}>
                <button
                  onClick={() => setExportMenuOpen((v) => !v)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Baixar
                </button>
                {exportMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px] z-30">
                    <button onClick={() => { setExportMenuOpen(false); exportarDRE_PDF(); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Baixar PDF
                    </button>
                    <button onClick={() => { setExportMenuOpen(false); if (dreTab === "ano") exportarDREAnual_CSV(); else exportarDRE_CSV(); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Baixar Planilha (CSV)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {dreTab === "mes" ? (
              /* ── Visão mensal ── */
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">DESCRIÇÃO</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase w-40">VALOR (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {dreLinhas.map((linha, idx) => {
                    if (!linha.label) return <tr key={idx} className="h-2" />;
                    const valExibido = linha.isNegativo ? -linha.valor : linha.valor;
                    const corValor = linha.isSubtotal
                      ? (valExibido >= 0 ? "text-gray-900" : "text-red-600")
                      : linha.indentLevel === 1
                        ? (linha.isNegativo ? "text-red-500" : "text-green-600")
                        : (linha.isNegativo ? "text-red-500" : "text-green-600");
                    const bgCls = linha.isSubtotal ? "bg-gray-50" : "";
                    const fontWeight = linha.isSubtotal ? "font-bold" : "font-medium";
                    return (
                      <tr key={idx} className={`border-b border-gray-50 ${bgCls} hover:bg-gray-50/60`}>
                        <td className={`px-3 py-2 ${fontWeight} ${linha.isSubtotal ? "text-gray-800" : "text-gray-600"} ${linha.indentLevel > 0 ? "pl-7" : ""}`}>
                          {linha.label}
                        </td>
                        <td className={`px-3 py-2 text-right ${fontWeight} ${corValor}`}>
                          {linha.isSubtotal && linha.label.startsWith("=") ? " " : ""}
                          {valExibido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* ── Visão anual: mês a mês ── */
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase whitespace-nowrap sticky left-0 bg-white z-10">DESCRIÇÃO</th>
                    {MES_LABELS.map((ml) => (
                      <th key={ml} className="text-right px-1.5 py-2 text-[10px] font-semibold text-gray-400 uppercase whitespace-nowrap min-w-[70px]">{ml}</th>
                    ))}
                    <th className="text-right px-2 py-2 text-[10px] font-semibold text-gray-700 uppercase whitespace-nowrap min-w-[80px] bg-gray-50/50">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {dreAnualRows.map((row, idx) => {
                    if (!row.label) return <tr key={idx} className="h-2" />;
                    const bgCls = row.isSubtotal ? "bg-gray-50" : "";
                    const fontWeight = row.isSubtotal ? "font-bold" : "font-medium";
                    return (
                      <tr key={idx} className={`border-b border-gray-50 ${bgCls} hover:bg-gray-50/60`}>
                        <td className={`px-2 py-1.5 ${fontWeight} ${row.isSubtotal ? "text-gray-800" : "text-gray-600"} ${row.indentLevel > 0 ? "pl-6" : ""} sticky left-0 bg-white z-10 ${bgCls ? "bg-gray-50" : "bg-white"}`}>
                          {row.label}
                        </td>
                        {row.valores.map((v, mi) => {
                          const exib = row.isNegativo ? -v : v;
                          const cor = row.isSubtotal
                            ? (exib >= 0 ? "text-gray-900" : "text-red-600")
                            : row.indentLevel === 1
                              ? (row.isNegativo ? "text-red-500" : "text-green-600")
                              : (row.isNegativo ? "text-red-500" : "text-green-600");
                          return (
                            <td key={mi} className={`px-1.5 py-1.5 text-right ${fontWeight} ${cor} ${exib === 0 ? "text-gray-300" : ""}`}>
                              {exib === 0 ? "-" : exib.toLocaleString("pt-BR", { currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </td>
                          );
                        })}
                        <td className={`px-2 py-1.5 text-right ${fontWeight} ${row.total >= 0 ? "text-gray-900" : "text-red-600"} bg-gray-50/50`}>
                          {row.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-[10px] text-gray-400">
              * DRE calculada com base nos lançamentos do Fluxo de Caixa agrupados por categoria.
            </p>
            {(() => {
              const resultadoFinal = dreTab === "mes"
                ? (dreLinhas.length > 0 ? (dreLinhas[dreLinhas.length - 1]?.valor ?? 0) : 0)
                : (dreAnualRows.length > 0 ? dreAnualRows[dreAnualRows.length - 1]?.total ?? 0 : 0);
              return (
                <div className={`text-sm font-bold ${resultadoFinal >= 0 ? "text-green-700" : "text-red-600"}`}>
                  Resultado: {resultadoFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* ══ TERMÔMETRO ══════════════════════════════════════════════════════ */}
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-[#fb4d06]/10 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-[#fb4d06]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Termômetro</h2>
              <p className="text-xs text-gray-500">Simule entradas e saídas em qualquer dia e veja o impacto no caixa</p>
            </div>
          </div>

          {/* ── Onde colocar? ── */}
          <div className="mb-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-0.5">Onde colocar?</h3>
            <p className="text-xs text-gray-500 mb-4">Informe um valor e descubra o melhor dia para lançá-lo com base no fluxo projetado</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                {(["saida", "entrada"] as const).map((t) => (
                  <button key={t} onClick={() => { setAnaliseTipo(t); setSugestoesAtivas(false); }}
                    className={`px-4 py-2 font-medium transition text-xs ${analiseTipo === t ? (t === "entrada" ? "bg-green-500 text-white" : "bg-red-500 text-white") : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                    {t === "entrada" ? "↑ Entrada a receber" : "↓ Saída a pagar"}
                  </button>
                ))}
              </div>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                <span className="px-3 text-xs text-gray-400 bg-gray-50 border-r border-gray-200 py-2">R$</span>
                <input type="number" step="0.01" min="0" placeholder="0,00" className="px-3 py-2 text-sm outline-none w-32"
                  value={analiseValor}
                  onChange={(e) => { setAnaliseValor(e.target.value); setSugestoesAtivas(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") setSugestoesAtivas(true); }} />
              </div>
              <button onClick={() => setSugestoesAtivas(true)} disabled={!analiseValor || parseFloat(analiseValor) <= 0}
                className="px-4 py-2 bg-[#fb4d06] text-white text-xs font-semibold rounded-xl hover:bg-[#e04400] disabled:opacity-40 transition">
                Analisar
              </button>
            </div>
            {sugestoesAtivas && sugestoes.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-xs text-gray-500">{analiseTipo === "saida" ? "Melhores dias para efetuar o pagamento (maior folga após pagar):" : "Dias onde a entrada teria maior impacto no caixa:"}</p>
                {sugestoes.map((s, idx) => {
                  const cols = { excelente: "border-green-200 bg-green-50", bom: "border-blue-200 bg-blue-50", aceitavel: "border-yellow-200 bg-yellow-50", critico: "border-red-200 bg-red-50" };
                  const badges = { excelente: "bg-green-100 text-green-700", bom: "bg-blue-100 text-blue-700", aceitavel: "bg-yellow-100 text-yellow-700", critico: "bg-red-100 text-red-700" };
                  const labels = { excelente: "Excelente", bom: "Bom", aceitavel: "Aceitável", critico: "Crítico" };
                  return (
                    <div key={s.data} className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${cols[s.nivel]}`}>
                      <span className="text-base font-bold text-gray-400 w-4">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800">{fmtDateFull(s.data)}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{s.motivo}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badges[s.nivel]}`}>{labels[s.nivel]}</span>
                      <button onClick={() => {
                        const val = parseFloat(analiseValor);
                        if (!isNaN(val)) {
                          const vf = analiseTipo === "saida" ? -val : val;
                          setSimulacoes((p) => [...p, { id: `sim${Date.now()}`, data: s.data, valor: vf, descricao: analiseTipo === "saida" ? "Pagamento sugerido" : "Recebimento sugerido" }]);
                          setSugestoesAtivas(false); setAnaliseValor("");
                          setTermoMesOffset(Math.round((new Date(s.data).getMonth() - new Date().getMonth() + 12) % 12));
                        }
                      }} className="text-xs text-gray-400 hover:text-[#fb4d06] transition whitespace-nowrap border border-current rounded-lg px-2 py-1">
                        Usar esse dia
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {sugestoesAtivas && sugestoes.length === 0 && analiseValor && (
              <div className="mt-3 text-xs text-red-500 bg-red-50 rounded-xl px-4 py-3">
                {analiseTipo === "saida" ? "Não há dias seguros nos próximos 60 dias — o saldo ficaria negativo." : "Nenhuma sugestão encontrada."}
              </div>
            )}
          </div>

          {/* ── Month nav ── */}
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setTermoMesOffset((p) => p - 1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition text-sm">‹</button>
            <span className="text-sm font-semibold text-gray-800 w-32 text-center capitalize">
              {new Date(termoMes.y, termoMes.m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </span>
            <button onClick={() => setTermoMesOffset((p) => p + 1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition text-sm">›</button>
            {simulacoes.length > 0 && (
              <button onClick={() => setSimulacoes([])} className="ml-1 text-xs text-gray-400 hover:text-red-500 transition border border-gray-200 rounded-lg px-2 py-1">
                Limpar simulações ({simulacoes.length})
              </button>
            )}
          </div>

          {/* ── Chart ── */}
          {termoRows.length > 0 && (() => {
            const allSaldos = [...termoRows.map((r) => r.saldoAuto), ...termoRows.map((r) => r.saldoSim)];
            const minS = Math.min(...allSaldos);
            const maxS = Math.max(...allSaldos);
            const range = maxS - minS || 1;
            const W = 100; const H = 60;
            const toX = (i: number) => (i / (termoRows.length - 1)) * (W - 2) + 1;
            const toY = (v: number) => H - 4 - ((v - minS) / range) * (H - 8);
            const autoLine = termoRows.map((r, i) => `${toX(i)},${toY(r.saldoAuto)}`).join(" ");
            const simLine = termoRows.map((r, i) => `${toX(i)},${toY(r.saldoSim)}`).join(" ");
            const todayIdx = termoRows.findIndex((r) => r.data === today);
            const zeroY = toY(0);
            const hasSims = simulacoes.length > 0;
            const minSaldoAuto = Math.min(...termoRows.map((r) => r.saldoAuto));
            return (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
                <div className="relative overflow-hidden rounded-xl bg-gray-50 border border-gray-100" style={{ height: 130 }}>
                  <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                    {zeroY > 0 && zeroY < H && <rect x="0" y={zeroY} width="100" height={H - zeroY} fill="rgba(239,68,68,0.06)" />}
                    {zeroY > 0 && zeroY < H && <line x1="0" y1={zeroY} x2="100" y2={zeroY} stroke="#ef4444" strokeWidth="0.3" strokeDasharray="1,1" />}
                    {todayIdx >= 0 && <line x1={toX(todayIdx)} y1="0" x2={toX(todayIdx)} y2={H} stroke="#6b7280" strokeWidth="0.4" strokeDasharray="1.5,1" />}
                    <polyline points={autoLine} fill="none" stroke="#6b7280" strokeWidth="1.2" strokeLinejoin="round" opacity="0.6" />
                    {hasSims && <polyline points={simLine} fill="none" stroke="#fb4d06" strokeWidth="1.8" strokeLinejoin="round" />}
                  </svg>
                  <div className="absolute top-2 right-2 flex gap-2 text-[9px]">
                    <span className="flex items-center gap-1 text-gray-400"><span className="w-3 h-0.5 bg-gray-400 inline-block rounded" />Projetado</span>
                    {hasSims && <span className="flex items-center gap-1 text-[#fb4d06]"><span className="w-3 h-0.5 bg-[#fb4d06] inline-block rounded" />Com simulação</span>}
                  </div>
                  {minSaldoAuto < 0 && <div className="absolute bottom-1 left-2 text-[9px] font-semibold text-red-500">⚠ Saldo negativo em algum ponto</div>}
                </div>
              </div>
            );
          })()}

          {/* ── Daily table ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase">Dia</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-green-600 uppercase">Entradas</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-red-500 uppercase">Saídas</th>
                  <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-[#fb4d06] uppercase">Simulação</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {termoRows.map((row) => {
                  const isAddingNew = simEditando === row.data && simIdEditando === null;
                  const hasSim = row.sims.length > 0;
                  const saldoDisplay = hasSim ? row.saldoSim : row.saldoAuto;
                  const saldoChanged = hasSim && row.saldoSim !== row.saldoAuto;
                  const isToday = row.data === today;

                  function openAdd() { setSimEditando(row.data); setSimIdEditando(null); setSimDraft({ valor: "", descricao: "", tipo: "entrada" }); }
                  function openEdit(s: Simulacao) { setSimEditando(row.data); setSimIdEditando(s.id); setSimDraft({ valor: String(Math.abs(s.valor)), descricao: s.descricao, tipo: s.valor >= 0 ? "entrada" : "saida" }); }
                  function closeForm() { setSimEditando(null); setSimIdEditando(null); }
                  function commitSim() {
                    const val = parseFloat(simDraft.valor);
                    if (isNaN(val) || val <= 0) return;
                    const vf = simDraft.tipo === "saida" ? -val : val;
                    if (simIdEditando) {
                      setSimulacoes((p) => p.map((x) => x.id === simIdEditando ? { ...x, valor: vf, descricao: simDraft.descricao } : x));
                    } else {
                      setSimulacoes((p) => [...p, { id: `sim${Date.now()}`, data: row.data, valor: vf, descricao: simDraft.descricao }]);
                    }
                    closeForm();
                  }

                  const showForm = simEditando === row.data;

                  return (
                    <>
                      <tr key={row.data} className={`border-b border-gray-50 transition-colors ${isToday ? "bg-blue-50/30" : row.isPast ? "opacity-55" : hasSim ? "bg-[#fb4d06]/[0.02]" : ""} hover:bg-gray-50/60`}>
                        <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                          {fmtDateFull(row.data)}
                          {isToday && <span className="ml-1.5 text-[9px] text-blue-500 font-semibold">hoje</span>}
                          {!row.isPast && !isToday && <span className="ml-1 text-[9px] text-gray-300 italic">proj.</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-green-600">{fmtBRLOrDash(row.entradasAuto)}</td>
                        <td className="px-3 py-2 text-right text-red-500">{fmtBRLOrDash(row.saidasAuto)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-center gap-0.5">
                            {row.sims.map((s) => (
                              <div key={s.id} className="flex items-center gap-1">
                                <button onClick={() => openEdit(s)} className={`font-semibold hover:underline cursor-pointer ${s.valor > 0 ? "text-[#fb4d06]" : "text-red-500"}`}>
                                  {s.valor > 0 ? "+" : ""}{fmtBRL(s.valor)}
                                </button>
                                {s.descricao && <span className="text-gray-400 text-[9px] max-w-[70px] truncate">{s.descricao}</span>}
                                <button onClick={() => setSimulacoes((p) => p.filter((x) => x.id !== s.id))} className="text-gray-300 hover:text-red-400">×</button>
                              </div>
                            ))}
                            {!row.isPast && (
                              <button onClick={openAdd} className="text-[9px] text-gray-300 hover:text-[#fb4d06] transition font-medium mt-0.5">
                                {hasSim ? "+ add" : "+ sim"}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${saldoDisplay < 0 ? "text-red-600" : saldoDisplay < 10000 ? "text-yellow-600" : "text-gray-800"}`}>
                          {fmtBRL(saldoDisplay)}
                          {saldoChanged && (
                            <span className={`ml-1 text-[9px] ${row.saldoSim > row.saldoAuto ? "text-green-500" : "text-red-500"}`}>
                              ({row.saldoSim > row.saldoAuto ? "+" : ""}{fmtBRL(row.saldoSim - row.saldoAuto)})
                            </span>
                          )}
                        </td>
                      </tr>
                      {showForm && (
                        <tr key={`${row.data}-form`} className="bg-[#fb4d06]/5 border-b border-[#fb4d06]/10">
                          <td colSpan={5} className="px-3 py-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                                {(["entrada", "saida"] as const).map((t) => (
                                  <button key={t} type="button" onClick={() => setSimDraft((p) => ({ ...p, tipo: t }))}
                                    className={`px-3 py-1.5 font-medium transition ${simDraft.tipo === t ? (t === "entrada" ? "bg-green-500 text-white" : "bg-red-500 text-white") : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                                    {t === "entrada" ? "↑ Entrada" : "↓ Saída"}
                                  </button>
                                ))}
                              </div>
                              <input type="number" step="0.01" min="0" placeholder="Valor (R$)"
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-28 outline-none focus:border-[#fb4d06]"
                                value={simDraft.valor} onChange={(e) => setSimDraft((p) => ({ ...p, valor: e.target.value }))} autoFocus />
                              <input type="text" placeholder="Descrição (opcional)"
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-40 outline-none focus:border-[#fb4d06]"
                                value={simDraft.descricao} onChange={(e) => setSimDraft((p) => ({ ...p, descricao: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === "Enter") commitSim(); if (e.key === "Escape") closeForm(); }} />
                              <button onClick={commitSim} disabled={!simDraft.valor || parseFloat(simDraft.valor) <= 0}
                                className="px-3 py-1.5 bg-[#fb4d06] text-white text-xs font-medium rounded-lg hover:bg-[#e04400] disabled:opacity-40 transition">
                                {simIdEditando ? "Salvar" : "Adicionar"}
                              </button>
                              {simIdEditando && (
                                <button onClick={() => { setSimulacoes((p) => p.filter((x) => x.id !== simIdEditando)); closeForm(); }}
                                  className="px-3 py-1.5 border border-red-200 text-red-500 text-xs rounded-lg hover:bg-red-50 transition">
                                  Excluir
                                </button>
                              )}
                              <button onClick={closeForm} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td className="px-3 py-2.5 text-gray-700">Total do mês</td>
                  <td className="px-3 py-2.5 text-right text-green-600">{fmtBRL(termoRows.reduce((s, r) => s + r.entradasAuto, 0))}</td>
                  <td className="px-3 py-2.5 text-right text-red-500">{fmtBRL(termoRows.reduce((s, r) => s + r.saidasAuto, 0))}</td>
                  <td className="px-3 py-2.5 text-center text-[#fb4d06]">
                    {(() => { const t = simulacoes.filter((s) => s.data.startsWith(`${termoMes.y}-${String(termoMes.m).padStart(2,"0")}`)).reduce((a, s) => a + s.valor, 0); return t !== 0 ? (t > 0 ? "+" : "") + fmtBRL(t) : "—"; })()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-900">
                    {termoRows.length > 0 ? fmtBRL(termoRows[termoRows.length - 1].saldoSim) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ══ Comparativo Mensal ════════════════════════════════════════════════ */}
          <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Comparativo Mensal</h3>
                <p className="text-xs text-gray-500 mt-0.5">Entradas, saídas e saldo acumulado mês a mês — real + projetado</p>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1 text-gray-500"><span className="w-2.5 h-2.5 rounded-sm bg-gray-300 inline-block" />Real</span>
                <span className="flex items-center gap-1 text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200 border border-gray-300 inline-block" />Projetado</span>
                {simulacoes.length > 0 && <span className="flex items-center gap-1 text-[#fb4d06]"><span className="w-2.5 h-2.5 rounded-sm bg-[#fb4d06]/20 border border-[#fb4d06]/40 inline-block" />Com sim.</span>}
              </div>
            </div>
            {(() => {
              const maxAbs = Math.max(...yearRowsWithSims.map((r) => Math.max(r.ent, r.sai)), 1);
              const hasSims = simulacoes.length > 0;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase w-20">Mês</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-green-600 uppercase">Entradas</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-red-500 uppercase">Saídas</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">Resultado</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">Saldo</th>
                        {hasSims && <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#fb4d06] uppercase">Saldo c/ Sim.</th>}
                        <th className="px-3 py-2 w-32" />
                      </tr>
                    </thead>
                    <tbody>
                      {yearRowsWithSims.map((row) => {
                        const entPct = (row.ent / maxAbs) * 100;
                        const saiPct = (row.sai / maxAbs) * 100;
                        const resultado = row.ent - row.sai;
                        return (
                          <tr key={row.m} className={`border-b border-gray-50 hover:bg-gray-50/50 ${row.isFuture ? "opacity-70" : ""}`}>
                            <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                              {fmtMonthYear(yearValue, row.m)}
                              {row.isFuture && <span className="ml-1 text-[9px] text-gray-300 italic">proj.</span>}
                            </td>
                            <td className="px-3 py-2 text-right text-green-600 font-medium">{fmtBRLOrDash(row.ent)}</td>
                            <td className="px-3 py-2 text-right text-red-500 font-medium">{fmtBRLOrDash(row.sai)}</td>
                            <td className={`px-3 py-2 text-right font-semibold ${resultado > 0 ? "text-green-600" : resultado < 0 ? "text-red-500" : "text-gray-300"}`}>
                              {resultado !== 0 ? (resultado > 0 ? "+" : "") + fmtBRL(resultado) : "—"}
                            </td>
                            <td className={`px-3 py-2 text-right font-semibold ${row.saldo >= 0 ? "text-gray-800" : "text-red-600"}`}>{fmtBRL(row.saldo)}</td>
                            {hasSims && <td className={`px-3 py-2 text-right font-semibold ${row.saldoSim >= 0 ? "text-[#fb4d06]" : "text-red-600"}`}>{fmtBRL(row.saldoSim)}</td>}
                            <td className="px-3 py-2">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-green-500 w-3">E</span>
                                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden w-20">
                                    <div className={`h-full rounded-full ${row.isFuture ? "bg-green-300" : "bg-green-500"}`} style={{ width: `${entPct}%` }} />
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-red-400 w-3">S</span>
                                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden w-20">
                                    <div className={`h-full rounded-full ${row.isFuture ? "bg-red-300" : "bg-red-500"}`} style={{ width: `${saiPct}%` }} />
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold text-xs">
                        <td className="px-3 py-2.5 text-gray-700">Total {yearValue}</td>
                        <td className="px-3 py-2.5 text-right text-green-600">{fmtBRL(yearRowsWithSims.reduce((s, r) => s + r.ent, 0))}</td>
                        <td className="px-3 py-2.5 text-right text-red-500">{fmtBRL(yearRowsWithSims.reduce((s, r) => s + r.sai, 0))}</td>
                        <td className={`px-3 py-2.5 text-right ${yearRowsWithSims.reduce((s, r) => s + r.ent - r.sai, 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {fmtBRL(yearRowsWithSims.reduce((s, r) => s + r.ent - r.sai, 0))}
                        </td>
                        <td className={`px-3 py-2.5 text-right ${(yearRowsWithSims[11]?.saldo ?? 0) >= 0 ? "text-gray-900" : "text-red-600"}`}>
                          {fmtBRL(yearRowsWithSims[11]?.saldo ?? 0)}
                        </td>
                        {hasSims && <td className={`px-3 py-2.5 text-right ${(yearRowsWithSims[11]?.saldoSim ?? 0) >= 0 ? "text-[#fb4d06]" : "text-red-600"}`}>{fmtBRL(yearRowsWithSims[11]?.saldoSim ?? 0)}</td>}
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* ══ Projeção Anual ════════════════════════════════════════════════════ */}
          <div className="mt-4 mb-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-800">Projeção Anual {yearValue}</h3>
              <p className="text-xs text-gray-500 mt-0.5">Contas fixas e próximos lançamentos mês a mês — reflexo do ano com base nos dados atuais</p>
            </div>
            {(() => {
              const allSaldos = yearRowsWithSims.map((r) => r.saldoSim);
              const minS = Math.min(...allSaldos);
              const maxS = Math.max(...allSaldos);
              const range = maxS - minS || 1;
              const H = 80; const W = 100;
              const toX = (i: number) => (i / 11) * (W - 4) + 2;
              const toY = (v: number) => H - 6 - ((v - minS) / range) * (H - 12);
              const saldoLine = yearRowsWithSims.map((r, i) => `${toX(i)},${toY(r.saldo)}`).join(" ");
              const simSaldoLine = simulacoes.length > 0 ? yearRowsWithSims.map((r, i) => `${toX(i)},${toY(r.saldoSim)}`).join(" ") : null;
              const zeroY = toY(0);
              const monthLabels = ["J","F","M","A","M","J","J","A","S","O","N","D"];
              const todayMon = new Date().getMonth(); // 0-indexed
              return (
                <div>
                  {/* Annual sparkline */}
                  <div className="relative rounded-xl bg-gray-50 border border-gray-100 overflow-hidden mb-4" style={{ height: 100 }}>
                    <svg viewBox="0 0 100 80" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                      {zeroY > 0 && zeroY < H && <rect x="0" y={zeroY} width="100" height={H - zeroY} fill="rgba(239,68,68,0.05)" />}
                      {zeroY > 0 && zeroY < H && <line x1="0" y1={zeroY} x2="100" y2={zeroY} stroke="#ef4444" strokeWidth="0.4" strokeDasharray="1.5,1" />}
                      {/* Today month marker */}
                      <line x1={toX(todayMon)} y1="0" x2={toX(todayMon)} y2={H} stroke="#6b7280" strokeWidth="0.5" strokeDasharray="2,1.5" />
                      <polyline points={saldoLine} fill="none" stroke="#6b7280" strokeWidth="1.2" strokeLinejoin="round" opacity="0.7" />
                      {simSaldoLine && <polyline points={simSaldoLine} fill="none" stroke="#fb4d06" strokeWidth="1.8" strokeLinejoin="round" />}
                      {/* Month dots */}
                      {yearRowsWithSims.map((r, i) => (
                        <circle key={r.m} cx={toX(i)} cy={toY(r.saldoSim)} r="0.8" fill={simulacoes.length > 0 ? "#fb4d06" : "#6b7280"} />
                      ))}
                    </svg>
                    {/* X-axis labels */}
                    <div className="absolute bottom-1 inset-x-0 flex justify-between px-1">
                      {monthLabels.map((l, i) => (
                        <span key={i} className={`text-[8px] ${i === todayMon ? "text-gray-600 font-bold" : "text-gray-300"}`}>{l}</span>
                      ))}
                    </div>
                  </div>

                  {/* Month-by-month breakdown cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {yearRowsWithSims.map((row) => {
                      const resultado = row.ent - row.sai;
                      const simImpact = row.simMes ?? 0;
                      const isCurrentMonth = row.m === new Date().getMonth() + 1 && yearValue === new Date().getFullYear();
                      return (
                        <div key={row.m} className={`rounded-xl p-3 border transition-all ${isCurrentMonth ? "border-[#fb4d06]/30 bg-[#fb4d06]/3" : "border-gray-100 bg-gray-50"} ${row.isFuture ? "opacity-75" : ""}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-gray-600 capitalize">
                              {new Date(yearValue, row.m - 1, 1).toLocaleDateString("pt-BR", { month: "short" })}
                              {row.isFuture && <span className="ml-1 text-[8px] text-gray-300">proj.</span>}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${resultado > 0 ? "bg-green-100 text-green-700" : resultado < 0 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-400"}`}>
                              {resultado > 0 ? "+" : ""}{fmtBRLOrDash(resultado)}
                            </span>
                          </div>
                          <p className={`text-sm font-bold ${row.saldoSim < 0 ? "text-red-600" : row.saldoSim < 20000 ? "text-yellow-600" : "text-gray-800"}`}>{fmtBRL(row.saldoSim)}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5">saldo acum.</p>
                          {(simImpact ?? 0) !== 0 && (
                            <p className={`text-[9px] font-semibold mt-1 ${simImpact > 0 ? "text-[#fb4d06]" : "text-red-500"}`}>
                              sim: {simImpact > 0 ? "+" : ""}{fmtBRL(simImpact)}
                            </p>
                          )}
                          {/* Mini entry/exit bars */}
                          <div className="mt-1.5 flex gap-1">
                            <div className="flex-1 h-0.5 rounded-full bg-green-400 opacity-70" style={{ maxWidth: `${Math.min((row.ent / (Math.max(row.ent, row.sai) || 1)) * 100, 100)}%` }} />
                            <div className="flex-1 h-0.5 rounded-full bg-red-400 opacity-70" style={{ maxWidth: `${Math.min((row.sai / (Math.max(row.ent, row.sai) || 1)) * 100, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Year summary */}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: "Total entradas", val: yearRowsWithSims.reduce((s, r) => s + r.ent, 0), color: "text-green-600" },
                      { label: "Total saídas", val: yearRowsWithSims.reduce((s, r) => s + r.sai, 0), color: "text-red-500" },
                      { label: `Saldo dez/${yearValue}`, val: yearRowsWithSims[11]?.saldoSim ?? 0, color: (yearRowsWithSims[11]?.saldoSim ?? 0) >= 0 ? "text-gray-800" : "text-red-600" },
                    ].map((item) => (
                      <div key={item.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p className="text-[10px] text-gray-500 mb-0.5">{item.label}</p>
                        <p className={`text-sm font-bold ${item.color}`}>{fmtBRL(item.val)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

      </main>

      {/* ── Detail Overlays ── */}
      {detalheAberto && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end" onClick={() => setDetalheAberto(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white w-full max-w-3xl h-full overflow-y-auto shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Overlay header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">
                {detalheAberto === "fluxo" && "Fluxo de Caixa — Detalhe"}
                {detalheAberto === "pagar" && "Contas a Pagar — Detalhe"}
                {detalheAberto === "receber" && "Contas a Receber — Detalhe"}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Imprimir
                </button>
                <button onClick={() => setDetalheAberto(null)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">✕ Fechar</button>
              </div>
            </div>

            <div className="px-6 py-5 flex flex-col gap-6">

              {/* ── Fluxo detail ── */}
              {detalheAberto === "fluxo" && fluxo && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Saldo Atual", val: saldoAtual, color: saldoAtual >= 0 ? "text-green-700" : "text-red-600" },
                      { label: "Total Entradas", val: fluxo.lancamentos.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0), color: "text-green-700" },
                      { label: "Total Saídas", val: Math.abs(fluxo.lancamentos.filter((l) => l.valor < 0).reduce((s, l) => s + l.valor, 0)), color: "text-red-600" },
                      { label: "Saldo do Mês", val: entradasMes - saidasMes, color: (entradasMes - saidasMes) >= 0 ? "text-green-700" : "text-red-600" },
                    ].map((c) => (
                      <div key={c.label} className="bg-gray-50 rounded-xl p-3">
                        <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                        <div className={`text-base font-bold ${c.color}`}>{fmtBRL(c.val)}</div>
                      </div>
                    ))}
                  </div>

                  {fluxoGrouped.map(({ month, rows }) => {
                    const [y, m] = month.split("-");
                    const subtotal = rows.reduce((s, r) => s + r.valor, 0);
                    return (
                      <div key={month}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-gray-700">{fmtMonthYear(Number(y), Number(m))}</h3>
                          <span className={`text-sm font-semibold ${subtotal >= 0 ? "text-green-700" : "text-red-600"}`}>{fmtBRL(subtotal)}</span>
                        </div>
                        <div className="rounded-xl border border-gray-100 overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-3 py-2 font-semibold text-gray-500">DATA</th>
                                <th className="text-left px-3 py-2 font-semibold text-gray-500">DESCRIÇÃO</th>
                                <th className="text-left px-3 py-2 font-semibold text-gray-500">CATEGORIA</th>
                                <th className="text-right px-3 py-2 font-semibold text-gray-500">VALOR</th>
                                <th className="text-right px-3 py-2 font-semibold text-gray-500">SALDO ACUM.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r) => (
                                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtDateFull(r.data)}</td>
                                  <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate">{r.obs ?? "—"}</td>
                                  <td className="px-3 py-2 text-gray-500 max-w-[140px] truncate">{r.categoria}</td>
                                  <td className={`px-3 py-2 text-right font-medium ${r.valor >= 0 ? "text-green-700" : "text-red-600"}`}>
                                    {fmtBRL(r.valor)}
                                  </td>
                                  <td className={`px-3 py-2 text-right ${r.saldoAcum >= 0 ? "text-gray-700" : "text-red-600"}`}>
                                    {fmtBRL(r.saldoAcum)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* ── Contas a Pagar detail ── */}
              {detalheAberto === "pagar" && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Total Pendente", val: totalPendente, color: "text-gray-900" },
                      { label: "Vencidas", val: totalVencido, color: "text-red-600" },
                      { label: "Próx. 7 dias", val: totalProx7, color: "text-yellow-700" },
                      { label: "Próx. 30 dias", val: contasPendentes.filter((c) => c.dataVencimento >= today && c.dataVencimento <= addDays(today, 30)).reduce((s, c) => s + c.valor, 0), color: "text-gray-700" },
                    ].map((c) => (
                      <div key={c.label} className="bg-gray-50 rounded-xl p-3">
                        <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                        <div className={`text-base font-bold ${c.color}`}>{fmtBRL(c.val)}</div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Por Categoria</h3>
                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">CATEGORIA</th>
                            <th className="text-right px-3 py-2 font-semibold text-gray-500">TOTAL</th>
                            <th className="text-right px-3 py-2 font-semibold text-gray-500">%</th>
                            <th className="px-3 py-2 w-32" />
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(
                            contasPendentes.reduce<Record<string, number>>((acc, c) => {
                              acc[c.categoria] = (acc[c.categoria] ?? 0) + c.valor;
                              return acc;
                            }, {})
                          )
                            .sort((a, b) => b[1] - a[1])
                            .map(([cat, val]) => (
                              <tr key={cat} className="border-b border-gray-50">
                                <td className="px-3 py-2 text-gray-700">{cat}</td>
                                <td className="text-right px-3 py-2 text-gray-700">{fmtBRL(val)}</td>
                                <td className="text-right px-3 py-2 text-gray-500">{totalPendente > 0 ? Math.round((val / totalPendente) * 100) : 0}%</td>
                                <td className="px-3 py-2">
                                  <div className="bg-gray-100 rounded-full h-1.5">
                                    <div className="bg-[#fb4d06] h-1.5 rounded-full" style={{ width: `${totalPendente > 0 ? (val / totalPendente) * 100 : 0}%` }} />
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Todas as Contas</h3>
                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">DATA VENC.</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">FORNECEDOR</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">DESCRIÇÃO</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">CATEGORIA</th>
                            <th className="text-right px-3 py-2 font-semibold text-gray-500">VALOR</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...contasPendentes].sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento)).map((c) => {
                            const isVencida = c.dataVencimento < today;
                            return (
                              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtDateFull(c.dataVencimento)}</td>
                                <td className="px-3 py-2 text-gray-700 max-w-[100px] truncate">{c.fornecedor}</td>
                                <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{c.descricao}</td>
                                <td className="px-3 py-2 text-gray-500 max-w-[100px] truncate">{c.categoria}</td>
                                <td className="px-3 py-2 text-right font-medium text-gray-700">{fmtBRL(c.valor)}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${isVencida ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                                    {isVencida ? "Vencida" : "Pendente"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* ── Contas a Receber detail ── */}
              {detalheAberto === "receber" && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Total a Receber", val: totalAReceber, color: "text-gray-900" },
                      { label: "Notas Emitidas", val: faturamentos.filter((f) => f.statusNota && f.statusNota !== "").reduce((s, f) => s + (f.valorAprovadoManual ?? 0), 0), color: "text-green-700" },
                      { label: "Sem Nota", val: faturamentos.filter((f) => !f.statusNota || f.statusNota === "").reduce((s, f) => s + (f.valorAprovadoManual ?? 0), 0), color: "text-yellow-700" },
                      { label: "Recebido", val: faturamentos.filter((f) => f.pago).reduce((s, f) => s + (f.valorAprovadoManual ?? 0), 0), color: "text-green-700" },
                    ].map((c) => (
                      <div key={c.label} className="bg-gray-50 rounded-xl p-3">
                        <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                        <div className={`text-base font-bold ${c.color}`}>{fmtBRL(c.val)}</div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Orçamentos a Receber</h3>
                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">CLIENTE</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">JOB</th>
                            <th className="text-right px-3 py-2 font-semibold text-gray-500">VALOR</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">STATUS NOTA</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">VENCIMENTO</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-500">PAGO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orcamentosRecebiveis.map((o) => {
                            const fat = faturamentos.find((f) => f.orcamentoId === o.id);
                            return (
                              <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                <td className="px-3 py-2 text-gray-700 max-w-[100px] truncate">{o.cliente}</td>
                                <td className="px-3 py-2 text-gray-600 max-w-[100px] truncate">{fat?.job ?? o.nomeProjeto ?? "—"}</td>
                                <td className="px-3 py-2 text-right font-medium text-gray-700">{fmtBRL(getOrcamentoValorAprovado(o))}</td>
                                <td className="px-3 py-2 text-gray-500">{fat?.statusNota ?? "—"}</td>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fat?.vencimento ? fmtDateFull(fat.vencimento) : "—"}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${fat?.pago ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                    {fat?.pago ? "Sim" : "Não"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {faturamentos.filter((f) => !f.orcamentoId).map((f) => (
                            <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                              <td className="px-3 py-2 text-gray-700 max-w-[100px] truncate">{f.cliente ?? "—"}</td>
                              <td className="px-3 py-2 text-gray-600 max-w-[100px] truncate">{f.job ?? "—"}</td>
                              <td className="px-3 py-2 text-right font-medium text-gray-700">{fmtBRL(f.valorAprovadoManual ?? 0)}</td>
                              <td className="px-3 py-2 text-gray-500">{f.statusNota ?? "—"}</td>
                              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{f.vencimento ? fmtDateFull(f.vencimento) : "—"}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${f.pago ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                  {f.pago ? "Sim" : "Não"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Categoria Detalhe Overlay ── */}
      {categoriaDetalhe && (() => {
        const contasCat = categoriaDetalhe.contas;
        const vencidas = contasCat.filter((c) => c.dataVencimento < today);
        const semana = contasCat.filter((c) => c.dataVencimento >= today && c.dataVencimento <= weekDays[6]);
        const futuras = contasCat.filter((c) => c.dataVencimento > weekDays[6]);
        const total = contasCat.reduce((s, c) => s + c.valor, 0);

        const grupos: { label: string; cor: string; items: ContaPagar[] }[] = [
          { label: "Vencidas", cor: "red", items: vencidas },
          { label: "Esta semana", cor: "yellow", items: semana },
          { label: "Futuras", cor: "gray", items: futuras },
        ].filter((g) => g.items.length > 0);

        return (
          <div className="fixed inset-0 z-50 flex items-stretch justify-end" onClick={() => setCategoriaDetalhe(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div>
                  <p className="text-[10px] font-semibold text-[#fb4d06] uppercase tracking-wide mb-0.5">Contas a Pagar</p>
                  <h2 className="text-base font-bold text-gray-900 leading-tight">{categoriaDetalhe.titulo}</h2>
                  {categoriaDetalhe.subtitulo && (
                    <p className="text-xs text-gray-400 mt-0.5">{categoriaDetalhe.subtitulo}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">{contasCat.length} lançamento{contasCat.length !== 1 ? "s" : ""} · total {fmtBRL(total)}</p>
                </div>
                <button
                  onClick={() => setCategoriaDetalhe(null)}
                  className="text-gray-400 hover:text-gray-600 transition mt-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* KPI strip */}
              <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-gray-50">
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-[10px] text-red-500 mb-0.5">Vencidas</p>
                  <p className="text-sm font-bold text-red-600">{fmtBRL(vencidas.reduce((s, c) => s + c.valor, 0))}</p>
                  <p className="text-[10px] text-red-400 mt-0.5">{vencidas.length} conta{vencidas.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-3">
                  <p className="text-[10px] text-yellow-600 mb-0.5">Esta semana</p>
                  <p className="text-sm font-bold text-yellow-700">{fmtBRL(semana.reduce((s, c) => s + c.valor, 0))}</p>
                  <p className="text-[10px] text-yellow-500 mt-0.5">{semana.length} conta{semana.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 mb-0.5">Futuras</p>
                  <p className="text-sm font-bold text-gray-700">{fmtBRL(futuras.reduce((s, c) => s + c.valor, 0))}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{futuras.length} conta{futuras.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {/* Grouped lists */}
              <div className="px-6 py-4 flex flex-col gap-5">
                {grupos.map(({ label, cor, items }) => {
                  const groupTotal = items.reduce((s, c) => s + c.valor, 0);
                  const headerColors: Record<string, string> = {
                    red: "text-red-700 bg-red-50 border-red-100",
                    yellow: "text-yellow-700 bg-yellow-50 border-yellow-100",
                    gray: "text-gray-600 bg-gray-50 border-gray-100",
                  };
                  const dotColors: Record<string, string> = {
                    red: "bg-red-400",
                    yellow: "bg-yellow-400",
                    gray: "bg-gray-300",
                  };
                  return (
                    <div key={label}>
                      <div className={`flex items-center justify-between px-3 py-2 rounded-xl border mb-2 ${headerColors[cor]}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${dotColors[cor]}`} />
                          <span className="text-xs font-semibold">{label}</span>
                          <span className="text-[10px] opacity-70">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                        </div>
                        <span className="text-xs font-bold">{fmtBRL(groupTotal)}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {items
                          .slice()
                          .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
                          .map((c) => (
                            <div key={c.id} className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-gray-200 transition">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-800 truncate">{c.fornecedor}</p>
                                {c.descricao && <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{c.descricao}</p>}
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[9px] text-gray-400">
                                    Venc. {fmtDateFull(c.dataVencimento)}
                                  </span>
                                  {c.dataVencimento < today && (
                                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                                      {Math.ceil((new Date(today).getTime() - new Date(c.dataVencimento).getTime()) / 86400000)} dias em atraso
                                    </span>
                                  )}
                                  {c.modalidade && (
                                    <span className="text-[9px] text-gray-400 px-1.5 py-0.5 rounded-full bg-gray-100">{c.modalidade}</span>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm font-bold text-gray-800 whitespace-nowrap">{fmtBRL(c.valor)}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}

                {contasCat.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">Nenhum lançamento encontrado para esta categoria.</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </WorkspaceLayout>
  );
}
