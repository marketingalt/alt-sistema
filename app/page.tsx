"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import WorkspaceLayout from "./components/WorkspaceLayout";
import StatusDropdown from "./components/StatusDropdown";
import MeusLembretes from "./components/MeusLembretes";
import Chart from "chart.js/auto";
import type { Orcamento, StatusOrcamento } from "./types";
import { STATUS_CONFIG } from "./types";

function totalOrcamento(o: Orcamento) {
  const produtos = o.itens.reduce((a, i) => a + (i.total || 0), 0);
  const servicos = o.manuseio && o.custoManuseio ? o.custoManuseio : 0;
  const frete = o.freteValor ?? 0;
  return produtos + servicos + frete;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtCompacto(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(".", ",") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(".", ",") + "k";
  return fmt(v);
}

const TODOS_STATUS = Object.keys(STATUS_CONFIG) as StatusOrcamento[];

function formatarDataAtual(): string {
  const hoje = new Date();
  const dias = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${dias[hoje.getDay()]}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
}

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [briefingCount, setBriefingCount] = useState(0);
  const [carregandoBriefing, setCarregandoBriefing] = useState(true);

  // Refs para os gráficos
  const doughnutRef = useRef<HTMLCanvasElement>(null);
  const chartDoughnutRef = useRef<Chart | null>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const chartBarRef = useRef<Chart | null>(null);

  const nome = user?.firstName || user?.fullName || "";

  useEffect(() => {
    fetch("/api/orcamentos")
      .then((r) => r.json())
      .then((data) => {
        setOrcamentos(data.map((o: Orcamento) => ({ ...o, status: o.status || "Em andamento" })));
        setCarregando(false);
      });
  }, []);

  useEffect(() => {
    fetch("/api/planejamento")
      .then((r) => r.json())
      .then((data) => {
        const projetos: any[] = (data.projetos || []).map((p: any) => ({
          ...p,
          statuses: p.statuses || [],
        }));
        const tarefas: any[] = data.tarefas || [];
        const principais = tarefas.filter((t: any) => !t.parentTaskId);
        const count = principais.filter((t: any) => {
          const projeto = projetos.find((p: any) => p.id === t.projectId);
          if (!projeto) return false;
          const primeiraColuna = [...projeto.statuses].sort((a: any, b: any) => a.ordem - b.ordem)[0];
          return primeiraColuna && t.statusId === primeiraColuna.id;
        }).length;
        setBriefingCount(count);
      })
      .catch(() => {})
      .finally(() => setCarregandoBriefing(false));
  }, []);

  const totalReceita = orcamentos.reduce((a, o) => a + totalOrcamento(o), 0);
  const aprovados = orcamentos.filter((o) => o.status === "Aprovado");
  const totalAprovado = aprovados.reduce((a, o) => a + totalOrcamento(o), 0);
  const taxaAprovacao = orcamentos.length > 0 ? ((aprovados.length / orcamentos.length) * 100).toFixed(0) : "0";

  const porStatus = useMemo(() => {
    return TODOS_STATUS.map((s) => ({
      status: s,
      count: orcamentos.filter((o) => (o.status || "Em andamento") === s).length,
      valor: orcamentos.filter((o) => (o.status || "Em andamento") === s).reduce((a, o) => a + totalOrcamento(o), 0),
      cfg: STATUS_CONFIG[s],
    })).filter((s) => s.count > 0);
  }, [orcamentos]);

  const recentes = [...orcamentos].slice(0, 5);

  const topOrcamentos = useMemo(() => {
    return [...orcamentos]
      .sort((a, b) => totalOrcamento(b) - totalOrcamento(a))
      .slice(0, 5);
  }, [orcamentos]);

  function atualizarStatus(id: string, novo: StatusOrcamento) {
    setOrcamentos((prev) => prev.map((o) => (o.id === id ? { ...o, status: novo } : o)));
  }

  // ── Gráfico Doughnut ──
  useEffect(() => {
    if (!doughnutRef.current || porStatus.length === 0) return;
    if (chartDoughnutRef.current) chartDoughnutRef.current.destroy();

    const ctx = doughnutRef.current.getContext("2d");
    if (!ctx) return;

    const colors = [
      "#3b82f6", "#eab308", "#22c55e", "#ef4444", "#9ca3af",
    ];

    chartDoughnutRef.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: porStatus.map((s) => s.status),
        datasets: [{
          data: porStatus.map((s) => s.count),
          backgroundColor: porStatus.map((_, i) => colors[i % colors.length]),
          borderColor: "#fff",
          borderWidth: 3,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyle: "circle",
              font: { size: 11, family: "'Inter', sans-serif" },
              color: "#64748b",
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const pct = ((ctx.raw as number) / total * 100).toFixed(1);
                return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
              },
            },
          },
        },
      },
      plugins: [{
        id: "centerText",
        beforeDraw(chart) {
          const { width, height, ctx: c } = chart;
          c.save();
          const total = (chart.data.datasets?.[0]?.data as number[])?.reduce((a, b) => a + b, 0) || 0;
          c.font = "700 28px 'Inter', sans-serif";
          c.fillStyle = "#1e293b";
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(String(total), width / 2, height / 2 - 8);
          c.font = "500 11px 'Inter', sans-serif";
          c.fillStyle = "#94a3b8";
          c.fillText("orçamentos", width / 2, height / 2 + 18);
          c.restore();
        },
      }],
    });
    return () => { if (chartDoughnutRef.current) chartDoughnutRef.current.destroy(); };
  }, [porStatus]);

  // ── Gráfico de Barras (Top 5) ──
  useEffect(() => {
    if (!barRef.current || topOrcamentos.length === 0) return;
    if (chartBarRef.current) chartBarRef.current.destroy();

    const ctx = barRef.current.getContext("2d");
    if (!ctx) return;

    const coresBarras = topOrcamentos.map((o) => {
      const cfg = STATUS_CONFIG[o.status || "Em andamento"];
      return cfg.dot.replace("bg-", "#").replace("blue-500", "3b82f6").replace("yellow-500", "eab308").replace("green-500", "22c55e").replace("red-500", "ef4444").replace("gray-400", "9ca3af");
    });

    // Converte nome das cores Tailwind para hex
    function twDotToHex(dotClass: string): string {
      const map: Record<string, string> = {
        "bg-blue-500": "#3b82f6",
        "bg-yellow-500": "#eab308",
        "bg-green-500": "#22c55e",
        "bg-red-500": "#ef4444",
        "bg-gray-400": "#9ca3af",
      };
      return map[dotClass] || "#3b82f6";
    }

    chartBarRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: topOrcamentos.map((o) => o.nomeProjeto || o.cliente || "Sem nome"),
        datasets: [{
          label: "Valor",
          data: topOrcamentos.map((o) => totalOrcamento(o)),
          backgroundColor: topOrcamentos.map((o) => twDotToHex(STATUS_CONFIG[o.status || "Em andamento"].dot)),
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: "y",
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
          x: {
            grid: { color: "rgba(0,0,0,0.04)" },
            border: { display: false },
            ticks: {
              color: "#94a3b8",
              font: { size: 10 },
              callback: (v) => fmtCompacto(Number(v)),
            },
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: "#64748b",
              font: { size: 10, family: "'Inter', sans-serif" },
            },
          },
        },
      },
    });
    return () => { if (chartBarRef.current) chartBarRef.current.destroy(); };
  }, [topOrcamentos]);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <WorkspaceLayout>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50">
        <div className="px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">

          {/* ── Header Personal ── */}
          <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 rounded-2xl border border-amber-100/60 shadow-sm p-6 lg:p-8">
            <div className="flex items-center gap-4">
              {user?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.imageUrl}
                  alt={nome}
                  className="w-14 h-14 rounded-full ring-4 ring-white shadow-md"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#fb4d06] to-orange-400 flex items-center justify-center text-lg font-bold text-white shadow-md ring-4 ring-white">
                  {(nome || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">
                  {saudacao}{nome ? `, ${nome.split(" ")[0]}` : ""}! 👋
                </h1>
                <p className="text-sm text-amber-700/70 mt-0.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatarDataAtual()}
                </p>
              </div>
              {nome && (
                <div className="hidden sm:flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-xl px-4 py-2 border border-amber-100/60">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-medium text-gray-500">Online</span>
                </div>
              )}
            </div>
          </div>

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/orcamentos" className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</p>
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {carregando ? "..." : orcamentos.length}
              </p>
              <p className="text-xs text-gray-400 mt-1">Orçamentos criados</p>
            </Link>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Valor total</p>
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-[#fb4d06]">{carregando ? "..." : fmt(totalReceita)}</p>
              <p className="text-xs text-gray-400 mt-1">Soma de todos</p>
            </div>

            <Link href="/planejamento" className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Briefings</p>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-indigo-600">
                {carregandoBriefing ? "..." : briefingCount}
              </p>
              <p className="text-xs text-gray-400 mt-1">Pendentes</p>
            </Link>

            <Link href="/orcamentos?status=Aprovado" className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Aprovação</p>
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-green-600">{carregando ? "..." : `${taxaAprovacao}%`}</p>
              <p className="text-xs text-gray-400 mt-1">{aprovados.length} aprovados</p>
            </Link>
          </div>

          {/* ── Meus Lembretes ── */}
          <MeusLembretes />

          {/* ── Gráficos Dinâmicos ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Doughnut - Status */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Distribuição por Status</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Orçamentos organizados por etapa</p>
                </div>
                <Link href="/orcamentos" className="text-xs font-medium text-[#fb4d06] hover:underline">
                  Ver todos →
                </Link>
              </div>
              {carregando || porStatus.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                  {carregando ? "Carregando..." : "Nenhum orçamento ainda."}
                </div>
              ) : (
                <div className="relative h-64">
                  <canvas ref={doughnutRef} />
                </div>
              )}
            </div>

            {/* Bar - Top 5 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Top Orçamentos</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Maiores valores registrados</p>
                </div>
                <Link href="/orcamentos" className="text-xs font-medium text-[#fb4d06] hover:underline">
                  Ver ranking →
                </Link>
              </div>
              {carregando || topOrcamentos.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                  {carregando ? "Carregando..." : "Nenhum orçamento ainda."}
                </div>
              ) : (
                <div className="relative h-64">
                  <canvas ref={barRef} />
                </div>
              )}
            </div>
          </div>

          {/* ── Orçamentos Recentes ── */}
          {recentes.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#fb4d06]/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#fb4d06]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recentes</h2>
                    <p className="text-xs text-gray-400">Últimos orçamentos criados</p>
                  </div>
                </div>
                <Link href="/orcamentos" className="text-xs font-semibold text-[#fb4d06] hover:underline flex items-center gap-1">
                  Ver todos
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              <div className="flex flex-col">
                {recentes.map((o, i) => (
                  <div
                    key={o.id}
                    className={`flex items-center justify-between py-3 px-4 rounded-xl hover:bg-gray-50 transition cursor-pointer ${
                      i < recentes.length - 1 ? "border-b border-gray-50" : ""
                    }`}
                    onClick={() => window.location.href = `/orcamentos/${o.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                        #{o.numero}
                      </span>
                      <Link
                        href={`/orcamentos/${o.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-medium text-gray-800 hover:text-[#fb4d06] transition truncate"
                      >
                        {o.nomeProjeto || o.cliente || "Sem projeto"}
                      </Link>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusDropdown
                        orcamentoId={o.id}
                        statusAtual={o.status || "Em andamento"}
                        onChange={(novo) => atualizarStatus(o.id, novo)}
                        alinhamento="right"
                      />
                      <span className="text-sm font-bold text-gray-700 tabular-nums">
                        {fmt(totalOrcamento(o))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
}
