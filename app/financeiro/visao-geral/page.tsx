"use client";

import { useEffect, useRef } from "react";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import Chart from "chart.js/auto";

// ── Dados Estruturados de Faturamento ──
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

const revenueData: MesFat[] = [
  { id: "25-05", mes: "Maio", ano: "2025", total: 68115, clientes: [{ nome: "Boleto (Não Ident.)", valor: 68115, corClass: "bg-slate-400" }] },
  { id: "25-06", mes: "Junho", ano: "2025", total: 0, clientes: [] },
  { id: "25-07", mes: "Julho", ano: "2025", total: 0, clientes: [] },
  { id: "25-08", mes: "Agosto", ano: "2025", total: 2175, clientes: [{ nome: "BEX Eventos", valor: 1174, corClass: "bg-slate-400" }, { nome: "Outros", valor: 1001, corClass: "bg-slate-400" }] },
  { id: "25-09", mes: "Setembro", ano: "2025", total: 1482, clientes: [{ nome: "BEX Eventos", valor: 1482, corClass: "bg-slate-400" }] },
  { id: "25-10", mes: "Outubro", ano: "2025", total: 69677, clientes: [{ nome: "MR Brindes", valor: 52744, corClass: "bg-purple-500" }, { nome: "Widi Care", valor: 15495, corClass: "bg-slate-400" }, { nome: "Outros", valor: 1438, corClass: "bg-slate-400" }] },
  { id: "25-11", mes: "Novembro", ano: "2025", total: 5995, clientes: [{ nome: "MR Brindes", valor: 4300, corClass: "bg-purple-500" }, { nome: "VCI Vanguard", valor: 1695, corClass: "bg-slate-400" }] },
  { id: "25-12", mes: "Dezembro", ano: "2025", total: 318164, clientes: [{ nome: "Blue Cosmetics", valor: 255753, corClass: "bg-indigo-500" }, { nome: "TEDs Diversos", valor: 62411, corClass: "bg-slate-400" }] },
  { id: "26-01", mes: "Janeiro", ano: "2026", total: 45080, clientes: [{ nome: "TEDs Diversos", valor: 39869, corClass: "bg-slate-400" }, { nome: "Aramis", valor: 3710, corClass: "bg-slate-400" }, { nome: "SBT Dist.", valor: 1500, corClass: "bg-slate-400" }] },
  { id: "26-02", mes: "Fevereiro", ano: "2026", total: 547490, clientes: [{ nome: "Wella Brasil", valor: 546430, corClass: "bg-sky-500" }, { nome: "Canecas CN", valor: 1060, corClass: "bg-slate-400" }] },
  { id: "26-03", mes: "Março", ano: "2026", total: 237157, clientes: [{ nome: "MR Brindes", valor: 192872, corClass: "bg-purple-500" }, { nome: "Aramis", valor: 37812, corClass: "bg-slate-400" }, { nome: "Outros", valor: 6473, corClass: "bg-slate-400" }] },
  { id: "26-04", mes: "Abril", ano: "2026", total: 25037, clientes: [{ nome: "Mastercard", valor: 20805, corClass: "bg-slate-400" }, { nome: "Outros", valor: 4232, corClass: "bg-slate-400" }] },
  { id: "26-05", mes: "Maio", ano: "2026", total: 170208, clientes: [{ nome: "Sephoria / D&G", valor: 166056, corClass: "bg-fuchsia-500" }, { nome: "Outros", valor: 4152, corClass: "bg-slate-400" }] },
  { id: "26-06", mes: "Junho", ano: "2026", total: 713899, clientes: [{ nome: "Daiichi Sankyo", valor: 415107, corClass: "bg-blue-600" }, { nome: "Moroccanoil", valor: 102279, corClass: "bg-slate-400" }, { nome: "SBT (Pend.)", valor: 72101, corClass: "bg-slate-400" }, { nome: "Outros", valor: 124412, corClass: "bg-slate-400" }] },
  { id: "26-07", mes: "Julho", ano: "2026", total: 319296, clientes: [{ nome: "Wella (Pend.)", valor: 297129, corClass: "bg-sky-500" }, { nome: "SBT (Pend.)", valor: 22167, corClass: "bg-slate-400" }] },
];

// ── Utilitários ──
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Mapa de cor → nome para a legenda de clientes recorrentes
const COR_POR_CLIENTE: Record<string, string> = {
  "Wella Brasil": "bg-sky-500",
  "Wella (Pend.)": "bg-sky-500",
  "Daiichi Sankyo": "bg-blue-600",
  "Blue Cosmetics": "bg-indigo-500",
  "MR Brindes": "bg-purple-500",
  "Sephoria / D&G": "bg-fuchsia-500",
};

// ── Componente Principal ──
export default function VisaoGeralFinanceiro() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroi gráfico anterior se existir
    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const labels = revenueData.map((d) => `${d.mes.substring(0, 3)}/${d.ano.substring(2)}`);
    const totals = revenueData.map((d) => d.total);

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Faturamento Total (R$)",
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
  }, []);

  return (
    <WorkspaceLayout>
      <main className="px-6 py-6 max-w-7xl mx-auto space-y-8">
        {/* ── Cabeçalho ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Painel de Volatilidade de Receita
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Análise da dependência de clientes e flutuação financeira (2025–2026)
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

        {/* ── Gráfico Principal ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">A Montanha-Russa Financeira</h2>
          <p className="text-sm text-gray-400 mb-6">
            Disparidade entre os meses de pico e os vales de faturamento.
          </p>
          <div className="relative h-72 w-full">
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* ── KPI Cards Resumo ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(() => {
            const mesesComReceita = revenueData.filter((d) => d.total > 0);
            const totalGeral = revenueData.reduce((s, d) => s + d.total, 0);
            const media = totalGeral / mesesComReceita.length;
            const maximo = Math.max(...revenueData.map((d) => d.total));
            const mesesZerados = revenueData.filter((d) => d.total === 0).length;
            return (
              <>
                <KpiCard
                  label="Faturamento Total (período)"
                  value={fmt(totalGeral)}
                  cor="text-gray-900"
                />
                <KpiCard
                  label="Média Mensal (c/ receita)"
                  value={fmt(Math.round(media))}
                  cor="text-[#fb4d06]"
                />
                <KpiCard
                  label="Maior Mês"
                  value={fmt(maximo)}
                  cor="text-green-700"
                />
                <KpiCard
                  label="Meses sem Receita"
                  value={String(mesesZerados)}
                  cor={mesesZerados > 0 ? "text-red-600" : "text-gray-900"}
                />
              </>
            );
          })()}
        </div>

        {/* ── Cartões Mensais ── */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-l-4 border-[#fb4d06] pl-3">
            Composição Mensal: Quem pagou a conta?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {revenueData.map((data) => (
              <MonthCard key={data.id} data={data} />
            ))}
          </div>
        </div>
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

function KpiCard({ label, value, cor }: { label: string; value: string; cor: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${cor}`}>{value}</p>
    </div>
  );
}

function MonthCard({ data }: { data: MesFat }) {
  // Mês sem receita
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

  // Ordenar clientes por valor (decrescente)
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
                <span className="text-gray-900 font-semibold w-24 text-right text-xs">
                  {fmt(c.valor)}
                </span>
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
