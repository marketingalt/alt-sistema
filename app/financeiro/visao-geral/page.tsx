"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import MeusLembretes from "@/app/components/MeusLembretes";
import Chart from "chart.js/auto";

// ── Tipos ──
interface Lancamento {
  id: string;
  data: string; // YYYY-MM-DD
  modalidade: string;
  banco: string;
  valor: number;
  area: string;
  categoria: string;
  obs: string;
  cliente?: string;
  createdAt: string;
}

interface DadosCaixa {
  saldoInicial: number;
  saldoInicialData: string;
  lancamentos: Lancamento[];
}

interface FaturamentoEntry {
  id?: string;
  orcamentoId?: string;
  tipo?: "manual" | "orcamento";
  cliente?: string;
  valorAprovadoManual?: number;
  vencimento?: string;
  pago?: boolean;
  dataPagamento?: string;
  job?: string;
}

interface ClienteFat {
  nome: string;
  valor: number;
  corClass: string;
}

interface MesFat {
  id: string;
  mes: string;
  ano: string;
  total: number;
  clientes: ClienteFat[];
}

// ── Utilitários ──
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Paleta de cores para clientes — cíclica, mas consistente por nome */
const CORES_CLIENTE = [
  "bg-sky-500",
  "bg-blue-600",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-fuchsia-500",
  "bg-pink-500",
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-500",
  "bg-teal-500",
  "bg-cyan-500",
];

function corPorNome(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = (hash * 31 + nome.charCodeAt(i)) | 0;
  }
  return CORES_CLIENTE[Math.abs(hash) % CORES_CLIENTE.length];
}

/**
 * Tenta extrair um nome de cliente legível do campo `obs` de uma receita.
 * Estratégia: procura padrões com "—", "–" (emdash/hífen) ou nomes conhecidos.
 * Se não identificar, retorna "Não identificado".
 */
function extrairCliente(obs: string): string {
  if (!obs) return "Não identificado";

  // Tenta padrão "— Nome" ou "Nome —"
  const emDash = obs.match(/—\s*(.+?)(?:\s*\(|,\s|$|\.)/);
  if (emDash) {
    const nome = emDash[1].trim();
    if (nome && nome.length > 2 && nome.length < 80) return nome;
  }

  // Tenta padrão "Nome —" (antes do —)
  const antes = obs.match(/^(.+?)\s*—/);
  if (antes) {
    const nome = antes[1].trim();
    // Ignora padrões genéricos como "Recebimento TED", "Crédito cobrança", etc.
    const genericos = [
      /^recebimento/i, /^cr[eé]dito/i, /^boleto/i, /^pagamento/i,
      /^transfer[eê]ncia/i, /^pix/i, /^ted/i, /^dep[óo]sito/i,
    ];
    const isGenerico = genericos.some((g) => g.test(nome));
    if (!isGenerico && nome.length > 2 && nome.length < 80) return nome;
  }

  // Palavras-chave conhecidas no texto
  const conhecidos: [RegExp, string][] = [
    [/wella/i, "Wella Brasil"],
    [/aramis/i, "Aramis"],
    [/mr brindes|brindes mr/i, "MR Brindes"],
    [/sbt/i, "SBT"],
    [/ever.?gym|estefania/i, "Ever Gym"],
    [/luiza.?baião|dra\. luiza/i, "Dra. Luiza Baião"],
    [/vo?e?sky/i, "VoeSky"],
    [/revaiah/i, "Revaiah"],
    [/ponto.?suprimentos/i, "Ponto Suprimentos"],
    [/mastercard/i, "Mastercard"],
    [/canecas.?cn/i, "Canecas CN"],
    [/blue.?cosmetics/i, "Blue Cosmetics"],
    [/daiichi|daichii/i, "Daiichi Sankyo"],
    [/sephoria/i, "Sephoria"],
    [/moroccanoil/i, "Moroccanoil"],
    [/widi.?care/i, "Widi Care"],
    [/bev.?eventos|bex/i, "BEX Eventos"],
  ];

  for (const [regex, nome] of conhecidos) {
    if (regex.test(obs)) return nome;
  }

  // Último recurso: se a obs tem algo que parece nome (palavras com maiúsculas)
  const palavras = obs.split(/\s+/).filter(
    (p) => p.length > 3 && /^[A-ZÀ-Ű][a-zà-ÿ]/.test(p) && !/^(Recebimento|Crédito|Boleto|Pagamento|Ted|Pix)$/i.test(p)
  );
  if (palavras.length >= 2) {
    return palavras.slice(0, 3).join(" ");
  }

  return "Não identificado";
}

// ── Componente Principal ──
export default function VisaoGeralFinanceiro() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const [dados, setDados] = useState<DadosCaixa | null>(null);
  const [faturamentos, setFaturamentos] = useState<FaturamentoEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [anoSelecionado, setAnoSelecionado] = useState<string>("");
  const [mesSelecionado, setMesSelecionado] = useState<string>("Todos");

  // Busca dados do fluxo de caixa + contas a receber
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/fluxo-caixa").then((r) => r.json()),
      fetch("/api/faturamentos").then((r) => r.json()),
    ])
      .then(([fc, fat]: [DadosCaixa, { registros: FaturamentoEntry[] }]) => {
        setDados(fc);
        setFaturamentos(fat.registros || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erro ao buscar dados:", err);
        setLoading(false);
      });
  }, []);

  // Processa os dados mensalmente
  const meses = useMemo<MesFat[]>(() => {
    if (!dados) return [];

    // ── 1. Receitas confirmadas do Fluxo de Caixa ──
    const lancamentos = dados.lancamentos || [];
    const receitas = lancamentos.filter(
      (l) => l?.categoria === "RECEITA OPERACIONAL BRUTA" && l?.valor > 0
    );

    // ── 2. Contas a Receber não pagas (evita duplicidade com FC) ──
    const pendentes = faturamentos
      .filter((f) => !f.pago && (f.cliente || f.valorAprovadoManual))
      .map((f) => ({
        id: f.id || "",
        data: f.vencimento || f.dataPagamento || "",
        modalidade: "",
        banco: "",
        valor: Math.abs(f.valorAprovadoManual || 0),
        area: "PROJETOS",
        categoria: "RECEITA OPERACIONAL BRUTA",
        obs: `${f.cliente || ""}${f.job ? " — " + f.job : ""}`,
        cliente: f.cliente || "",
        createdAt: "",
      } as Lancamento));

    // ── 3. Unifica ──
    const todas = [...receitas, ...pendentes];

    // Agrupa por mês, validando o formato da data
    const grupos = new Map<string, Lancamento[]>();
    for (const r of todas) {
      // Proteção contra data ausente ou em formato inválido
      if (!r.data || typeof r.data !== "string") continue;
      const trimmed = r.data.trim();
      if (trimmed.length < 7) continue;
      const chave = trimmed.substring(0, 7); // YYYY-MM
      // Só aceita chave com hífen (formato YYYY-MM ou YYYY-MM-DD)
      if (!chave.includes("-")) continue;
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push(r);
    }

    const resultado: MesFat[] = [];

    // Só processa meses que realmente têm dados
    const chaves = [...grupos.keys()].sort();
    for (const chave of chaves) {
      const [anoStr, mesStr] = chave.split("-");
      const ano = Number(anoStr);
      const mes = Number(mesStr);

      // Pula se ano ou mês não forem números válidos
      if (isNaN(ano) || isNaN(mes) || mes < 1 || mes > 12) continue;

      const chaveId = `${String(ano).slice(-2)}-${String(mes).padStart(2, "0")}`;

      // Agrupa receitas por cliente dentro do mês
      const clientes = new Map<string, number>();
      for (const r of grupos.get(chave)!) {
        const nome = r.cliente || extrairCliente(r.obs);
        clientes.set(nome, (clientes.get(nome) || 0) + r.valor);
      }

      const total = [...clientes.values()].reduce((s, v) => s + v, 0);

      resultado.push({
        id: chaveId,
        mes: MESES[mes - 1],
        ano: String(ano),
        total: Math.round(total),
        clientes: [...clientes.entries()]
          .map(([nome, valor]) => ({
            nome,
            valor: Math.round(valor),
            corClass: corPorNome(nome),
          }))
          .sort((a, b) => b.valor - a.valor),
      });
    }

    return resultado;
  }, [dados, faturamentos]);

  // Anos disponíveis (dos que têm dados)
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<string>();
    for (const m of meses) anos.add(m.ano);
    return [...anos].sort((a, b) => Number(b) - Number(a)); // mais recente primeiro
  }, [meses]);

  // Meses disponíveis no ano selecionado
  const mesesDisponiveisNoAno = useMemo(() => {
    if (!anoSelecionado) return [];
    return meses.filter((m) => m.ano === anoSelecionado).map((m) => m.mes);
  }, [meses, anoSelecionado]);

  // Define ano inicial quando os dados carregam
  useEffect(() => {
    if (!anoSelecionado && anosDisponiveis.length > 0) {
      setAnoSelecionado(anosDisponiveis[0]);
    }
  }, [anosDisponiveis, anoSelecionado]);

  // Dados filtrados por ano e (opcionalmente) mês
  const mesesFiltrados = useMemo(() => {
    let filtrado = meses;
    if (anoSelecionado) {
      filtrado = filtrado.filter((m) => m.ano === anoSelecionado);
    }
    if (mesSelecionado !== "Todos") {
      filtrado = filtrado.filter((m) => m.mes === mesSelecionado);
    }
    // Filtro de segurança: remove entradas com dados ausentes
    return filtrado.filter((m) => m.mes && m.ano);
  }, [meses, anoSelecionado, mesSelecionado]);

  // Renderiza/atualiza o gráfico quando os meses filtrados mudam
  useEffect(() => {
    if (!canvasRef.current || mesesFiltrados.length === 0) return;

    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = mesesFiltrados.map((m) => `${(m.mes || "?").substring(0, 3)}/${(m.ano || "??").substring(2)}`);
    const totals = mesesFiltrados.map((m) => m.total);

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Faturamento (R$)",
            data: totals,
            borderColor: "#fb4d06",
            backgroundColor: "rgba(251, 77, 6, 0.08)",
            borderWidth: 3,
            pointBackgroundColor: "#fb4d06",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => fmt(ctx.raw as number),
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,0.06)" },
            border: { display: false },
            ticks: {
              color: "#94a3b8",
              callback: (v) => "R$ " + (Number(v) / 1000).toFixed(0) + "k",
            },
          },
          x: {
            grid: { display: false },
            ticks: { color: "#94a3b8" },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [mesesFiltrados]);

  // ── Loading ──
  if (loading) {
    return (
      <WorkspaceLayout>
        <main className="px-6 py-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-[#fb4d06] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Carregando dados...</p>
            </div>
          </div>
        </main>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout>
      <main className="px-6 py-6 max-w-7xl mx-auto space-y-8">
        {/* ── Meus Lembretes ── */}
        <MeusLembretes />

        {/* ── Cabeçalho ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Painel de Volatilidade de Receita
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Análise da dependência de clientes e flutuação financeira — dados do Fluxo de Caixa e Contas a Receber
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="print-hide bg-[#fb4d06] hover:bg-[#e04400] text-white font-semibold py-2.5 px-5 rounded-xl transition-colors flex items-center gap-2 text-sm shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Exportar PDF
          </button>
        </div>

        {/* ── Filtros ── */}
        {anosDisponiveis.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ano</label>
              <select
                value={anoSelecionado}
                onChange={(e) => { setAnoSelecionado(e.target.value); setMesSelecionado("Todos"); }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
              >
                {anosDisponiveis.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Mês</label>
              <select
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
              >
                <option>Todos</option>
                {mesesDisponiveisNoAno.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── Gráfico Principal ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">A Montanha-Russa Financeira</h2>
          <p className="text-sm text-gray-400 mb-6">
            Disparidade entre os meses de pico e os vales de faturamento.
          </p>
          {mesesFiltrados.length === 0 ? (
            <div className="flex items-center justify-center h-72 text-gray-400">
              Nenhum dado de receita encontrado no Fluxo de Caixa ou Contas a Receber.
            </div>
          ) : (
            <div className="relative h-72 w-full">
              <canvas ref={canvasRef} />
            </div>
          )}
        </div>

        {/* ── KPI Cards Resumo ── */}
        {mesesFiltrados.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              const mesesComReceita = mesesFiltrados.filter((d) => d.total > 0);
              const totalGeral = mesesFiltrados.reduce((s, d) => s + d.total, 0);
              const media = mesesComReceita.length > 0 ? totalGeral / mesesComReceita.length : 0;
              const maximo = Math.max(...mesesFiltrados.map((d) => d.total));
              const mesesZerados = mesesFiltrados.filter((d) => d.total === 0).length;
              return (
                <>
                  <KpiCard label="Receita Total (período)" value={fmt(totalGeral)} cor="text-gray-900" />
                  <KpiCard label="Média Mensal (c/ receita)" value={fmt(Math.round(media))} cor="text-[#fb4d06]" />
                  <KpiCard label="Maior Mês" value={fmt(maximo)} cor="text-green-700" />
                  <KpiCard
                    label="Meses sem Receita"
                    value={String(mesesZerados)}
                    cor={mesesZerados > 0 ? "text-red-600" : "text-gray-900"}
                  />
                </>
              );
            })()}
          </div>
        )}

        {/* ── Cartões Mensais ── */}
        {mesesFiltrados.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-l-4 border-[#fb4d06] pl-3">
              Análise de Faturamento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {mesesFiltrados.map((m) => (
                <MonthCard key={m.id} data={m} />
              ))}
            </div>
          </div>
        )}

        {mesesFiltrados.length === 0 && !loading && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <p className="text-gray-400 text-lg">
              Nenhum lançamento de{" "}
              <span className="font-semibold text-gray-600">Receita Operacional Bruta</span> ou <span className="font-semibold text-gray-600">Contas a Receber</span> encontrado.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Cadastre receitas no <span className="font-medium">Fluxo de Caixa</span> ou <span className="font-medium">Contas a Receber</span> para começar a visualizar o painel.
            </p>
          </div>
        )}
      </main>

      {/* ── Estilos de Impressão ── */}
      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .print-hide {
            display: none !important;
          }
          .bg-white {
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
          }
          canvas {
            max-width: 100% !important;
            height: auto !important;
            page-break-inside: avoid;
          }
          .month-card {
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 1rem;
          }
        }
      `}</style>
    </WorkspaceLayout>
  );
}

// ── Componentes Internos ──

function KpiCard({
  label,
  value,
  cor,
}: {
  label: string;
  value: string;
  cor: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${cor}`}>{value}</p>
    </div>
  );
}

function MonthCard({ data }: { data: MesFat }) {
  if (data.total === 0) {
    return (
      <div className="month-card bg-white rounded-2xl border border-red-200 shadow-sm p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-400" />
        <div className="flex justify-between items-end mb-3">
          <div>
            <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">{data.ano}</span>
            <h3 className="text-lg font-bold text-gray-800">{data.mes}</h3>
          </div>
          <div className="text-xl font-black text-red-500">{fmt(0)}</div>
        </div>
        <div className="flex h-5 rounded-full overflow-hidden bg-gray-100 border border-gray-200" />
        <div className="text-center py-4 text-red-500 font-medium italic text-sm">
          Sem registo de faturação
        </div>
      </div>
    );
  }

  const clientesOrd = [...data.clientes].sort((a, b) => b.valor - a.valor);
  const topClientePct = (clientesOrd[0].valor / data.total) * 100;
  const isHighlyDependent = topClientePct > 80;

  return (
    <div
      className={`month-card bg-white rounded-2xl border shadow-sm p-5 transition-shadow hover:shadow-md ${
        isHighlyDependent ? "border-orange-200" : "border-gray-100"
      }`}
    >
      <div className="flex justify-between items-end mb-3">
        <div>
          <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">{data.ano}</span>
          <h3 className="text-lg font-bold text-gray-800">{data.mes}</h3>
        </div>
        <div className="text-xl font-black text-gray-900">{fmt(data.total)}</div>
      </div>

      {/* Barra Visual de Composição */}
      <div className="flex h-5 rounded-full overflow-hidden bg-gray-100 border border-gray-200 mb-1">
        {clientesOrd.map((c, i) => {
          const pct = (c.valor / data.total) * 100;
          return (
            <div
              key={i}
              className={`h-full ${c.corClass}`}
              style={{ width: `${pct}%` }}
              title={`${c.nome}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Legenda */}
      <div className="mt-3 border-t border-gray-100 pt-3 space-y-1.5">
        {clientesOrd.map((c, i) => {
          const pct = ((c.valor / data.total) * 100).toFixed(1);
          return (
            <div key={i} className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2 truncate min-w-0 pr-2">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.corClass}`} />
                <span className="text-gray-600 truncate font-medium">{c.nome}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-gray-400 text-xs font-mono w-10 text-right">{pct}%</span>
                <span className="text-gray-900 font-semibold w-24 text-right text-xs">{fmt(c.valor)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {isHighlyDependent && (
        <div className="mt-3 text-xs text-orange-700 bg-orange-50 py-1.5 px-3 rounded-lg text-center font-medium">
          ⚠️ Alta dependência num único cliente ({topClientePct.toFixed(0)}%)
        </div>
      )}
    </div>
  );
}
