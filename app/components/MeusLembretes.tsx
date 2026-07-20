"use client";

import { useEffect, useState, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import type { Tarefa, Projeto, StatusKanban } from "@/app/types";

type Periodo = "dia" | "semana" | "mes";

interface TarefaComOrigem {
  tarefa: Tarefa;
  projetoNome: string;
  projetoCor: string;
  statusNome: string;
  statusCor: string;
  origem: "planejamento" | "financeiro";
}

function formatRelativeTime(date: Date): string {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(date);
  data.setHours(0, 0, 0, 0);
  const diff = Math.round((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return `há ${Math.abs(diff)} dia${Math.abs(diff) > 1 ? "s" : ""} atrás`;
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  return `Em ${diff} dias`;
}

function formatData(data: string): string {
  if (!data) return "";
  const d = new Date(data + "T12:00:00");
  return d.toLocaleDateString("pt-BR");
}

function ordenarTarefas(tarefas: TarefaComOrigem[]): TarefaComOrigem[] {
  return [...tarefas].sort((a, b) => {
    if (!a.tarefa.dataVencimento && !b.tarefa.dataVencimento) return 0;
    if (!a.tarefa.dataVencimento) return 1;
    if (!b.tarefa.dataVencimento) return -1;
    return a.tarefa.dataVencimento.localeCompare(b.tarefa.dataVencimento);
  });
}

function primeiroStatusNaoConcluido(statuses: StatusKanban[]): StatusKanban | undefined {
  return [...statuses].sort((a, b) => a.ordem - b.ordem).find((s) => s.nome !== "CONCLUÍDO");
}

function ehStatusConcluido(statusNome: string): boolean {
  return statusNome === "CONCLUÍDO" || statusNome === "Concluído";
}

// ── Grupos de data ──

function enquadrar(vencimento: string | undefined, periodo: Periodo): string | null {
  if (!vencimento) return "Sem data";

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(vencimento + "T12:00:00");
  data.setHours(0, 0, 0, 0);
  const diff = Math.round((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return "Atrasado";
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";

  if (periodo === "dia") return null; // só hoje

  // semana: até domingo desta semana
  const fimSemana = new Date(hoje);
  fimSemana.setDate(hoje.getDate() + (6 - hoje.getDay())); // sábado
  const diffFimSemana = Math.round((fimSemana.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= diffFimSemana) return "Esta semana";

  if (periodo === "semana") return null; // só esta semana

  // mês: até fim do mês
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const diffFimMes = Math.round((fimMes.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= diffFimMes) return "Este mês";

  return "Futuro";
}

const GRUPOS_ORDEM = ["Atrasado", "Hoje", "Amanhã", "Esta semana", "Este mês", "Futuro", "Sem data"] as const;

export default function MeusLembretes() {
  const { user, isLoaded } = useUser();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [tarefasPlanejamento, setTarefasPlanejamento] = useState<Tarefa[]>([]);
  const [tarefasFinanceiro, setTarefasFinanceiro] = useState<Tarefa[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expandido, setExpandido] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    setLoading(true);
    setErro(null);

    Promise.all([
      fetch("/api/planejamento").then((r) => {
        if (!r.ok) throw new Error("Erro ao carregar planejamento");
        return r.json();
      }),
      fetch("/api/financeiro/planejamento/tarefas").then((r) => {
        if (!r.ok) throw new Error("Erro ao carregar tarefas financeiras");
        return r.json();
      }),
    ])
      .then(([planejamento, tarefasFin]) => {
        setProjetos(planejamento.projetos || []);
        setTarefasPlanejamento(planejamento.tarefas || []);
        setTarefasFinanceiro(tarefasFin || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erro ao carregar lembretes:", err);
        setErro("Não foi possível carregar seus lembretes.");
        setLoading(false);
      });
  }, [isLoaded]);

  // Mapa de projetos por id
  const projetosMap = useMemo(() => {
    const map = new Map<string, Projeto>();
    for (const p of projetos) map.set(p.id, p);
    return map;
  }, [projetos]);

  // Mapa de status por projectId
  function getStatusNome(projectId: string, statusId: string): { nome: string; cor: string } {
    const projeto = projetosMap.get(projectId);
    if (!projeto) return { nome: statusId, cor: "#6b7280" };
    const status = projeto.statuses.find((s) => s.id === statusId);
    return status ? { nome: status.nome, cor: status.cor } : { nome: statusId, cor: "#6b7280" };
  }

  // Nome do usuário logado para match com responsaveis[]
  const nomeUsuario = user?.fullName || user?.firstName || "";

  // Filtra tarefas onde o usuário é responsável
  const tarefasDoUsuario = useMemo(() => {
    const todas: TarefaComOrigem[] = [];

    // Tarefas do planejamento
    for (const t of tarefasPlanejamento) {
      const projeto = projetosMap.get(t.projectId);
      // Se o usuário não é responsável e não é participante do projeto, pula
      const ehResponsavel = nomeUsuario && t.responsaveis.some((r) => r.toLowerCase().includes(nomeUsuario.toLowerCase()));
      const ehParticipante = projeto?.participantes?.some((p) => {
        const matchNome = p.nome.toLowerCase().includes(nomeUsuario.toLowerCase());
        const matchId = p.userId === user?.id;
        return matchNome || matchId;
      });
      if (!ehResponsavel && !ehParticipante) continue;

      // Ignora subtarefas (mostra apenas tarefas principais)
      if (t.parentTaskId) continue;

      const status = getStatusNome(t.projectId, t.statusId);
      if (ehStatusConcluido(status.nome)) continue;

      todas.push({
        tarefa: t,
        projetoNome: projeto?.nome || "Planejamento",
        projetoCor: projeto?.cor || "#6366f1",
        statusNome: status.nome,
        statusCor: status.cor,
        origem: "planejamento",
      });
    }

    // Tarefas do financeiro
    for (const t of tarefasFinanceiro) {
      const ehResponsavel = nomeUsuario && t.responsaveis.some((r) => r.toLowerCase().includes(nomeUsuario.toLowerCase()));
      if (!ehResponsavel) continue;
      if (t.parentTaskId) continue;

      const status = getStatusNome(t.projectId, t.statusId);
      if (ehStatusConcluido(status.nome)) continue;

      todas.push({
        tarefa: t,
        projetoNome: "Financeiro",
        projetoCor: "#059669",
        statusNome: status.nome,
        statusCor: status.cor,
        origem: "financeiro",
      });
    }

    return ordenarTarefas(todas);
  }, [tarefasPlanejamento, tarefasFinanceiro, projetosMap, nomeUsuario, user?.id]);

  // Agrupa por data conforme período selecionado
  const grupos = useMemo(() => {
    const gruposMap = new Map<string, TarefaComOrigem[]>();

    for (const t of tarefasDoUsuario) {
      const grupo = enquadrar(t.tarefa.dataVencimento, periodo);
      if (grupo === null) continue;
      if (!gruposMap.has(grupo)) gruposMap.set(grupo, []);
      gruposMap.get(grupo)!.push(t);
    }

    // Ordena grupos
    const resultado: { grupo: string; tarefas: TarefaComOrigem[] }[] = [];
    for (const g of GRUPOS_ORDEM) {
      const tarefas = gruposMap.get(g);
      if (tarefas && tarefas.length > 0) resultado.push({ grupo: g, tarefas });
    }

    return resultado;
  }, [tarefasDoUsuario, periodo]);

  const totalLembretes = tarefasDoUsuario.length;

  const iconeStatusLinha = (origem: string) =>
    origem === "financeiro" ? "bg-emerald-500" : "bg-indigo-500";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-gray-50 transition"
        onClick={() => setExpandido((p) => !p)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">Meus Lembretes</h2>
            {totalLembretes > 0 && (
              <p className="text-xs text-gray-400">
                {totalLembretes} {totalLembretes === 1 ? "pendência" : "pendências"}
              </p>
            )}
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expandido ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expandido && (
        <>
          {/* Abas Dia/Semana/Mês */}
          <div className="px-6 pb-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              {(["dia", "semana", "mes"] as Periodo[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition ${
                    periodo === p
                      ? "bg-white text-gray-800 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {p === "dia" ? "Dia" : p === "semana" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
          </div>

          {/* Conteúdo */}
          <div className="px-6 pb-5">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#fb4d06] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : erro ? (
              <p className="text-sm text-gray-400 text-center py-6">{erro}</p>
            ) : grupos.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-400">
                  {periodo === "dia" ? "Nenhuma tarefa pendente para hoje." : "Nenhuma tarefa pendente."} 🎉
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {grupos.map(({ grupo, tarefas }) => {
                  const corGrupo =
                    grupo === "Atrasado" ? "text-red-600" :
                    grupo === "Hoje" ? "text-amber-600" :
                    grupo === "Amanhã" ? "text-orange-500" :
                    grupo === "Sem data" ? "text-gray-400" :
                    "text-gray-600";
                  const bgGrupo =
                    grupo === "Atrasado" ? "bg-red-50" :
                    grupo === "Hoje" ? "bg-amber-50" :
                    grupo === "Sem data" ? "bg-gray-50" :
                    "bg-gray-50";

                  return (
                    <div key={grupo}>
                      <div className={`flex items-center gap-2 mb-1.5 ${bgGrupo} rounded-lg px-3 py-1.5`}>
                        <span className={`text-xs font-bold uppercase tracking-wider ${corGrupo}`}>
                          {grupo}
                        </span>
                        <span className="text-xs text-gray-400">· {tarefas.length}</span>
                      </div>
                      <div className="space-y-1">
                        {tarefas.map(({ tarefa, projetoNome, projetoCor, statusNome, statusCor, origem }) => {
                          const href = origem === "financeiro"
                            ? "/financeiro/planejamento"
                            : `/planejamento/${tarefa.projectId}`;

                          return (
                            <Link
                              key={tarefa.id}
                              href={href}
                              className="flex items-start gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition group"
                            >
                              {/* Indicador de origem */}
                              <div className={`w-1 self-stretch rounded-full shrink-0 ${iconeStatusLinha(origem)}`} />

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-gray-800 truncate">
                                    {tarefa.titulo}
                                  </span>
                                  {/* Tag do projeto */}
                                  <span
                                    className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded shrink-0"
                                    style={{ backgroundColor: projetoCor }}
                                  >
                                    {projetoNome}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {/* Status da tarefa */}
                                  <span
                                    className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                                    style={{
                                      backgroundColor: statusCor + "20",
                                      color: statusCor,
                                    }}
                                  >
                                    {statusNome}
                                  </span>
                                  {/* Data de vencimento */}
                                  {tarefa.dataVencimento ? (
                                    <span className={`text-[11px] ${
                                      enquadrar(tarefa.dataVencimento, "mes") === "Atrasado"
                                        ? "text-red-500 font-semibold"
                                        : "text-gray-400"
                                    }`}>
                                      {formatData(tarefa.dataVencimento)}
                                      <span className="text-gray-300 ml-1">·</span>
                                      <span className="ml-1">{formatRelativeTime(new Date(tarefa.dataVencimento + "T12:00:00"))}</span>
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-gray-300">Sem vencimento</span>
                                  )}
                                </div>
                              </div>

                              {/* Seta indicando link */}
                              <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
