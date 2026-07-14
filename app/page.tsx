"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import WorkspaceLayout from "./components/WorkspaceLayout";
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

const TODOS_STATUS = Object.keys(STATUS_CONFIG) as StatusOrcamento[];

export default function Dashboard() {
  const { user } = useUser();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [briefingCount, setBriefingCount] = useState(0);
  const [carregandoBriefing, setCarregandoBriefing] = useState(true);

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

  const porStatus = TODOS_STATUS.map((s) => ({
    status: s,
    count: orcamentos.filter((o) => (o.status || "Em andamento") === s).length,
    valor: orcamentos.filter((o) => (o.status || "Em andamento") === s).reduce((a, o) => a + totalOrcamento(o), 0),
  })).filter((s) => s.count > 0);

  const recentes = [...orcamentos].slice(0, 5);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <WorkspaceLayout>
      <div className="px-8 py-8 max-w-5xl">

        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            {saudacao}{nome ? `, ${nome.split(" ")[0]}` : ""}! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Aqui está o resumo do seu workspace.</p>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          <Link href="/orcamentos" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-[#fb4d06]/20 transition">
            <p className="text-xs text-gray-400 mb-1">Total de orçamentos</p>
            <p className="text-3xl font-bold text-gray-800">{orcamentos.length}</p>
          </Link>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs text-gray-400 mb-1">Valor total</p>
            <p className="text-xl font-bold text-[#fb4d06]">{fmt(totalReceita)}</p>
          </div>
          <Link href="/orcamentos?status=Aprovado" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-green-200 transition">
            <p className="text-xs text-gray-400 mb-1">Aprovados</p>
            <p className="text-3xl font-bold text-green-600">{aprovados.length}</p>
          </Link>
          <Link href="/planejamento" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-indigo-200 transition">
            <p className="text-xs text-gray-400 mb-1">Briefing na casa</p>
            <p className="text-3xl font-bold text-indigo-600">
              {carregandoBriefing ? "..." : briefingCount}
            </p>
          </Link>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs text-gray-400 mb-1">Valor aprovado</p>
            <p className="text-xl font-bold text-green-600">{fmt(totalAprovado)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {/* Status dos orçamentos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Por status</h2>
            {carregando ? (
              <p className="text-gray-400 text-sm">Carregando...</p>
            ) : porStatus.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhum orçamento ainda.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {porStatus.map(({ status, count, valor }) => {
                  const cfg = STATUS_CONFIG[status];
                  const pct = orcamentos.length > 0 ? (count / orcamentos.length) * 100 : 0;
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className="text-sm text-gray-700 font-medium">{status}</span>
                          <span className="text-xs text-gray-400">{count}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-600">{fmt(valor)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${cfg.dot} opacity-70`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ação rápida */}
          <div className="flex flex-col gap-4">
            <Link href="/novo">
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl p-6 cursor-pointer hover:shadow-md transition group">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-white/30 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="font-bold text-gray-900">Novo Orçamento</span>
                </div>
                <p className="text-sm text-gray-800 opacity-80">Cole um pedido e a IA gera o orçamento.</p>
              </div>
            </Link>
            <Link href="/orcamentos">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-[#fb4d06]/20 transition">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-[#fb4d06]/10 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#fb4d06]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="font-bold text-gray-800">Ver todos os orçamentos</span>
                </div>
                <p className="text-sm text-gray-500">Lista completa com filtros e PDFs.</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Recentes */}
        {recentes.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Orçamentos recentes</h2>
              <Link href="/orcamentos" className="text-xs text-[#fb4d06] hover:underline">Ver todos →</Link>
            </div>
            <div className="flex flex-col gap-2">
              {recentes.map((o) => {
                const cfg = STATUS_CONFIG[o.status || "Em andamento"];
                return (
                  <Link key={o.id} href={`/orcamentos/${o.id}`}>
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 transition cursor-pointer">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-[#fb4d06] bg-[#fb4d06]/5 px-2 py-0.5 rounded-full whitespace-nowrap">
                          #{o.numero}
                        </span>
                        <span className="text-sm font-medium text-gray-800">{o.nomeProjeto || o.cliente || "Sem projeto"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.cor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {o.status || "Em andamento"}
                        </span>
                        <span className="text-sm font-bold text-[#fb4d06] whitespace-nowrap">
                          {fmt(totalOrcamento(o))}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </WorkspaceLayout>
  );
}
