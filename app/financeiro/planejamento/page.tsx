"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Tarefa, StatusOrcamento } from "@/app/types";
import { apiFetch } from "@/lib/api-fetch";

// ── Helpers ──

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

function hoje() {
  return new Date().toISOString().split("T")[0];
}

function formatarData(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatarTempo(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function estaAtrasada(dataVencimento?: string): boolean {
  if (!dataVencimento) return false;
  return dataVencimento < hoje();
}

function formatarValor(valor?: number): string {
  if (valor === undefined || valor === null) return "";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const CORES_ETIQUETA = [
  { nome: "Urgente", cor: "#ef4444" },
  { nome: "Importante", cor: "#f97316" },
  { nome: "Em andamento", cor: "#3b82f6" },
  { nome: "Revisão", cor: "#a855f7" },
  { nome: "Concluído", cor: "#22c55e" },
];

function Icone({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL — Kanban Financeiro
// ═══════════════════════════════════════════════════════════

export default function FinanceiroPlanejamentoPage() {
  const [colunas, setColunas] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [tarefaAberta, setTarefaAberta] = useState<Tarefa | null>(null);

  const [visao, setVisao] = useState<"kanban" | "calendario">("kanban");
  const [mesCalendario, setMesCalendario] = useState(() => new Date().getMonth());
  const [anoCalendario, setAnoCalendario] = useState(() => new Date().getFullYear());

  // Timer ativo
  const [timerAtivo, setTimerAtivo] = useState<{ tarefaId: string; startTime: string } | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer tick — atualiza a cada segundo enquanto timer roda
  useEffect(() => {
    if (!timerAtivo) {
      if (timerInterval.current) clearInterval(timerInterval.current);
      return;
    }
    timerInterval.current = setInterval(() => {
      setTarefas((prev) => [...prev]);
    }, 1000);
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [timerAtivo]);

  async function carregar() {
    try {
      const [resColunas, resTarefas] = await Promise.all([
        apiFetch("/api/financeiro/planejamento"),
        apiFetch("/api/financeiro/planejamento/tarefas"),
      ]);
      if (resColunas.ok) {
        setColunas(await resColunas.json());
      }
      if (resTarefas.ok) {
        setTarefas(await resTarefas.json());
      }
    } catch {
      // fallback silencioso
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar().catch(() => setCarregando(false));
  }, []);

  async function atualizarTarefa(id: string, campos: Partial<Tarefa>) {
    setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, ...campos } : t)));
    if (tarefaAberta?.id === id) setTarefaAberta((prev) => (prev ? { ...prev, ...campos } : null));
    await apiFetch("/api/financeiro/planejamento/tarefas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...campos }),
    });
  }

  // ═════════════════════════════════════════════
  // GESTÃO DE COLUNAS
  // ═════════════════════════════════════════════

  async function handleSalvarStatuses(statuses: any[]) {
    const res = await apiFetch("/api/financeiro/planejamento", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colunas: statuses }),
    });
    if (res.ok) {
      setColunas(await res.json());
    }
  }

  function handleNovaColuna() {
    const nome = prompt("Nome da coluna:");
    if (!nome?.trim()) return;
    const novosStatuses = [
      ...colunas,
      { id: gerarId(), nome: nome.trim(), cor: "#6b7280", ordem: colunas.length },
    ];
    handleSalvarStatuses(novosStatuses);
  }

  function handleDeletarColuna(statusId: string) {
    if (colunas.length <= 1) return;
    if (!confirm("Excluir esta coluna e todas as suas tarefas?")) return;
    const novosStatuses = colunas.filter((s: any) => s.id !== statusId);
    handleSalvarStatuses(novosStatuses);
  }

  // ═════════════════════════════════════════════
  // NOVA TAREFA
  // ═════════════════════════════════════════════

  async function handleNovaTarefa(statusId: string) {
    const titulo = prompt("Título da tarefa:");
    if (!titulo?.trim()) return;
    const res = await apiFetch("/api/financeiro/planejamento/tarefas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId, titulo: titulo.trim() }),
    });
    if (res.ok) {
      const nova = await res.json();
      setTarefas((prev) => [...prev, nova]);
    }
  }

  async function handleDeletarTarefa(id: string) {
    if (!confirm("Excluir esta tarefa?")) return;
    await apiFetch(`/api/financeiro/planejamento/tarefas?id=${id}`, { method: "DELETE" });
    setTarefas((prev) => prev.filter((t) => t.id !== id && t.parentTaskId !== id));
    if (tarefaAberta?.id === id) setTarefaAberta(null);
  }

  // ═════════════════════════════════════════════
  // DRAG & DROP (dnd-kit)
  // ═════════════════════════════════════════════

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const tarefaAtiva = activeId ? tarefas.find((t) => t.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const tarefaId = String(active.id);
    const tarefaAtual = tarefas.find((t) => t.id === tarefaId);
    if (!tarefaAtual) return;

    // Descobrir a coluna de destino
    const overId = String(over.id);
    const overTarefa = tarefas.find((t) => t.id === overId);
    const colunaDestinoId = overTarefa ? overTarefa.statusId : overId;

    if (colunaDestinoId === tarefaAtual.statusId) return;

    // Encontrar a ordem correta
    const tarefasNaColuna = tarefas
      .filter((t) => t.statusId === colunaDestinoId && t.id !== tarefaId && !t.parentTaskId)
      .sort((a, b) => a.ordem - b.ordem);

    await atualizarTarefa(tarefaId, { statusId: colunaDestinoId, ordem: tarefasNaColuna.length });
  }

  // ═════════════════════════════════════════════
  // TIMER
  // ═════════════════════════════════════════════

  async function handleTimer(tarefaId: string) {
    if (timerAtivo) {
      if (timerAtivo.tarefaId === tarefaId) {
        const res = await apiFetch("/api/financeiro/planejamento/tarefas/timer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tarefaId, action: "stop" }),
        });
        if (res.ok) {
          const atualizada: Tarefa = await res.json();
          setTarefas((prev) => prev.map((t) => (t.id === tarefaId ? atualizada : t)));
          setTarefaAberta(atualizada);
          setTimerAtivo(null);
        }
      } else {
        await apiFetch("/api/financeiro/planejamento/tarefas/timer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tarefaId: timerAtivo.tarefaId, action: "stop" }),
        });
        await apiFetch("/api/financeiro/planejamento/tarefas/timer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tarefaId, action: "start" }),
        });
        await carregar();
        setTimerAtivo({ tarefaId, startTime: new Date().toISOString() });
      }
    } else {
      const res = await apiFetch("/api/financeiro/planejamento/tarefas/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tarefaId, action: "start" }),
      });
      if (res.ok) {
        const atualizada: Tarefa = await res.json();
        setTarefas((prev) => prev.map((t) => (t.id === tarefaId ? atualizada : t)));
        setTarefaAberta(atualizada);
        setTimerAtivo({ tarefaId, startTime: new Date().toISOString() });
      }
    }
  }

  // ═════════════════════════════════════════════
  // SUBTAREFAS
  // ═════════════════════════════════════════════

  async function handleNovaSubtarefa(titulo: string) {
    if (!tarefaAberta) return;
    const primeiroStatus = colunas.sort((a: any, b: any) => a.ordem - b.ordem)[0];
    if (!primeiroStatus) return;

    const res = await apiFetch("/api/financeiro/planejamento/tarefas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statusId: primeiroStatus.id,
        titulo,
        parentTaskId: tarefaAberta.id,
        customFields: tarefaAberta.customFields,
      }),
    });
    if (res.ok) {
      const nova = await res.json();
      setTarefas((prev) => [...prev, nova]);
      setTarefaAberta((prev) => (prev ? { ...prev, updatedAt: nova.updatedAt } : null));
    }
  }

  async function handleAlternarSubtarefa(subtarefa: Tarefa, completo: boolean) {
    if (completo) {
      const statusConcluido = colunas.find((s: any) => s.nome === "CONCLUÍDO");
      if (statusConcluido) {
        await atualizarTarefa(subtarefa.id, { statusId: statusConcluido.id });
      }
    } else {
      const primeiroStatus = [...colunas].sort((a: any, b: any) => a.ordem - b.ordem)[0];
      if (primeiroStatus) {
        await atualizarTarefa(subtarefa.id, { statusId: primeiroStatus.id });
      }
    }
  }

  // ═════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════

  if (carregando) {
    return (
      <WorkspaceLayout>
        <main className="px-8 py-8 max-w-full">
          <p className="text-gray-500 text-sm">Carregando...</p>
        </main>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <h1 className="text-xl font-bold text-gray-800">Planejamento Financeiro</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle kanban/calendario */}
            <div className="flex bg-gray-100 rounded-xl p-0.5">
              <button
                onClick={() => setVisao("kanban")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  visao === "kanban" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icone d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" className="w-3.5 h-3.5 inline mr-1" />
                Kanban
              </button>
              <button
                onClick={() => setVisao("calendario")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  visao === "calendario" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icone d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" className="w-3.5 h-3.5 inline mr-1" />
                Calendário
              </button>
            </div>
          </div>
        </div>

        {/* Calendário */}
        {visao === "calendario" ? (
          <CalendarioView
            colunas={colunas}
            tarefas={tarefas}
            mes={mesCalendario}
            ano={anoCalendario}
            onMesAnterior={() => {
              if (mesCalendario === 0) { setMesCalendario(11); setAnoCalendario((a) => a - 1); }
              else setMesCalendario((m) => m - 1);
            }}
            onMesSeguinte={() => {
              if (mesCalendario === 11) { setMesCalendario(0); setAnoCalendario((a) => a + 1); }
              else setMesCalendario((m) => m + 1);
            }}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <KanbanBoard
              colunas={colunas}
              tarefas={tarefas}
              timerAtivo={timerAtivo}
              onNovaTarefa={handleNovaTarefa}
              onAbrirTarefa={(t) => setTarefaAberta(t)}
              onDeletarTarefa={handleDeletarTarefa}
              onSalvarStatuses={handleSalvarStatuses}
            />
            <DragOverlay>
              {tarefaAtiva ? (
                <div className="bg-white rounded-xl border-2 border-emerald-500 p-3 shadow-xl max-w-72">
                  <p className="text-sm font-semibold text-gray-800">{tarefaAtiva.titulo}</p>
                  {(tarefaAtiva.customFields?.orcamentoValor as number) > 0 && (
                    <p className="text-xs text-emerald-600 font-semibold mt-1">
                      {formatarValor(tarefaAtiva.customFields?.orcamentoValor as number)}
                    </p>
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      {/* Drawer de tarefa */}
      {tarefaAberta && (
        <TaskDrawer
          tarefa={tarefaAberta}
          colunas={colunas}
          tarefas={tarefas}
          timerAtivo={timerAtivo}
          onFechar={() => setTarefaAberta(null)}
          onAtualizar={atualizarTarefa}
          onDeletar={handleDeletarTarefa}
          onTimer={handleTimer}
          onNovaSubtarefa={handleNovaSubtarefa}
          onAlternarSubtarefa={handleAlternarSubtarefa}
        />
      )}
    </WorkspaceLayout>
  );
}

// ═══════════════════════════════════════════════════════════
// KANBAN BOARD
// ═══════════════════════════════════════════════════════════

function ColunaKanban({
  statusId,
  children,
}: {
  statusId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: statusId });
  return <div ref={setNodeRef} className="flex-1 px-3 py-3 space-y-2 overflow-y-auto min-h-[200px]">{children}</div>;
}

function KanbanBoard({
  colunas,
  tarefas,
  timerAtivo,
  onNovaTarefa,
  onAbrirTarefa,
  onDeletarTarefa,
  onSalvarStatuses,
}: {
  colunas: any[];
  tarefas: Tarefa[];
  timerAtivo: { tarefaId: string; startTime: string } | null;
  onNovaTarefa: (statusId: string) => void;
  onAbrirTarefa: (t: Tarefa) => void;
  onDeletarTarefa: (id: string) => void;
  onSalvarStatuses: (statuses: any[]) => void;
}) {
  const [renomeandoStatusId, setRenomeandoStatusId] = useState<string | null>(null);
  const [renomeandoValor, setRenomeandoValor] = useState("");

  const tarefasPrincipais = tarefas.filter((t) => !t.parentTaskId);
  const tarefasPorStatus = new Map<string, Tarefa[]>();
  for (const s of colunas) {
    tarefasPorStatus.set(
      s.id,
      tarefasPrincipais.filter((t) => t.statusId === s.id).sort((a, b) => a.ordem - b.ordem)
    );
  }

  return (
    <div>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]" style={{ scrollbarWidth: "thin" }}>
        {[...colunas]
          .sort((a, b) => a.ordem - b.ordem)
          .map((status) => {
            const cards = tarefasPorStatus.get(status.id) || [];
            return (
              <div
                key={status.id}
                className="flex-shrink-0 w-72 bg-gray-100/70 rounded-2xl flex flex-col"
              >
                {/* Cabeçalho da coluna */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/50">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: status.cor }} />
                    {renomeandoStatusId === status.id ? (
                      <input
                        type="text"
                        value={renomeandoValor}
                        onChange={(e) => setRenomeandoValor(e.target.value)}
                        onBlur={() => {
                          const valor = renomeandoValor.trim();
                          if (valor && valor !== status.nome) {
                            onSalvarStatuses(
                              colunas.map((s: any) =>
                                s.id === status.id ? { ...s, nome: valor } : s
                              )
                            );
                          }
                          setRenomeandoStatusId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          } else if (e.key === "Escape") {
                            setRenomeandoStatusId(null);
                          }
                        }}
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        className="text-xs font-bold text-gray-700 uppercase tracking-wide bg-white border border-gray-300 rounded px-1.5 py-0.5 w-28 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="text-xs font-bold text-gray-700 uppercase tracking-wide cursor-pointer hover:text-emerald-600 transition"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenomeandoValor(status.nome);
                          setRenomeandoStatusId(status.id);
                        }}
                      >
                        {status.nome}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 bg-gray-200/50 rounded-full px-2 py-0.5 font-medium">{cards.length}</span>
                  </div>
                  <button
                    onClick={() => onDeletarTarefa(status.id)}
                    className="text-gray-400 hover:text-red-500 transition p-0.5"
                    title="Excluir coluna"
                  >
                    <Icone d="M6 18L18 6M6 6l12 12" className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Cartões */}
                <ColunaKanban statusId={status.id}>
                  <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    {cards.length === 0 && (
                      <div className="text-center py-8 text-gray-400 text-xs">Arraste tarefas para cá</div>
                    )}
                    {cards.map((tarefa) => (
                      <CardFinanceiro
                        key={tarefa.id}
                        tarefa={tarefa}
                        tarefas={tarefas}
                        timerAtivo={timerAtivo}
                        onClick={() => onAbrirTarefa(tarefa)}
                      />
                    ))}
                  </SortableContext>
                </ColunaKanban>

                {/* Botão adicionar */}
                <div className="px-3 pb-3">
                  <button
                    onClick={() => onNovaTarefa(status.id)}
                    className="w-full flex items-center justify-center gap-1 py-2 text-xs font-medium text-gray-500 hover:text-emerald-600 hover:bg-white/50 rounded-xl transition border border-dashed border-gray-300 hover:border-emerald-500/30"
                  >
                    <Icone d="M12 4v16m8-8H4" className="w-3.5 h-3.5" />
                    Adicionar tarefa
                  </button>
                </div>
              </div>
            );
          })}

        {/* Botão adicionar coluna */}
        <div className="flex-shrink-0 w-72">
          <button
            onClick={handleNovaColuna}
            className="w-full h-32 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-emerald-500/30 hover:text-emerald-600 transition bg-white/50"
          >
            <Icone d="M12 4v16m8-8H4" className="w-4 h-4" />
            Adicionar coluna
          </button>
        </div>
      </div>
    </div>
  );

  function handleNovaColuna() {
    const nome = prompt("Nome da coluna:");
    if (!nome?.trim()) return;
    const novosStatuses = [
      ...colunas,
      { id: gerarId(), nome: nome.trim(), cor: "#6b7280", ordem: colunas.length },
    ];
    onSalvarStatuses(novosStatuses);
  }
}

// ═══════════════════════════════════════════════════════════
// CARD (Cartão dnd-kit sortable)
// ═══════════════════════════════════════════════════════════

function CardFinanceiro({
  tarefa,
  tarefas,
  timerAtivo,
  onClick,
}: {
  tarefa: Tarefa;
  tarefas: Tarefa[];
  timerAtivo: { tarefaId: string; startTime: string } | null;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tarefa.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const subtarefas = tarefas.filter((t) => t.parentTaskId === tarefa.id);
  const timerRodando = timerAtivo?.tarefaId === tarefa.id;
  const atrasada = estaAtrasada(tarefa.dataVencimento);

  const valor = tarefa.customFields?.orcamentoValor as number | undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-white rounded-xl border p-3 shadow-sm hover:shadow-md transition cursor-grab active:cursor-grabbing group ${
        isDragging ? "opacity-50 ring-2 ring-emerald-500/40" : "border-gray-200 hover:border-gray-300"
      } ${timerRodando ? "ring-2 ring-green-400" : ""} ${atrasada ? "border-red-300" : ""}`}
    >
      {/* Valor do orçamento */}
      {valor !== undefined && valor > 0 && (
        <div className="mb-2">
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
            {formatarValor(valor)}
          </span>
        </div>
      )}

      {/* Título */}
      <p className="text-sm font-semibold text-gray-800">{tarefa.titulo}</p>

      {/* Descrição preview */}
      {tarefa.descricao && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{tarefa.descricao}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          {/* Data de vencimento */}
          {tarefa.dataVencimento && (
            <span className={`flex items-center gap-1 ${atrasada ? "text-red-500 font-semibold" : ""}`}>
              <Icone d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" className="w-3 h-3" />
              {formatarData(tarefa.dataVencimento)}
            </span>
          )}

          {/* Subtarefas */}
          {subtarefas.length > 0 && (
            <span className="flex items-center gap-1">
              <Icone d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" className="w-3 h-3" />
              {subtarefas.length}
            </span>
          )}
        </div>

        {/* Timer indicator */}
        {timerRodando && (
          <span className="flex items-center gap-1 text-green-500">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            {timerAtivo && formatarTempo(
              Math.floor((Date.now() - new Date(timerAtivo.startTime).getTime()) / 1000)
            )}
          </span>
        )}
        {tarefa.timeTracking.totalSeconds > 0 && !timerRodando && (
          <span className="text-gray-400">{formatarTempo(tarefa.timeTracking.totalSeconds)}</span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TASK DRAWER (Painel Lateral)
// ═══════════════════════════════════════════════════════════

function TaskDrawer({
  tarefa,
  colunas,
  tarefas,
  timerAtivo,
  onFechar,
  onAtualizar,
  onDeletar,
  onTimer,
  onNovaSubtarefa,
  onAlternarSubtarefa,
}: {
  tarefa: Tarefa;
  colunas: any[];
  tarefas: Tarefa[];
  timerAtivo: { tarefaId: string; startTime: string } | null;
  onFechar: () => void;
  onAtualizar: (id: string, campos: Partial<Tarefa>) => void;
  onDeletar: (id: string) => void;
  onTimer: (tarefaId: string) => void;
  onNovaSubtarefa: (titulo: string) => void;
  onAlternarSubtarefa: (t: Tarefa, completo: boolean) => void;
}) {
  const [tituloEdit, setTituloEdit] = useState(tarefa.titulo);
  const [descricaoEdit, setDescricaoEdit] = useState(tarefa.descricao || "");
  const [dataVencimentoEdit, setDataVencimentoEdit] = useState(tarefa.dataVencimento || "");
  const [etiquetasEdit, setEtiquetasEdit] = useState(tarefa.etiquetas);
  const [subtarefaInput, setSubtarefaInput] = useState("");

  const subtarefas = tarefas.filter((t) => t.parentTaskId === tarefa.id);
  const statusConcluido = colunas.find((s: any) => s.nome === "CONCLUÍDO");
  const timerRodando = timerAtivo?.tarefaId === tarefa.id;
  const valor = tarefa.customFields?.orcamentoValor as number | undefined;

  function salvarTitulo() {
    if (tituloEdit.trim() && tituloEdit !== tarefa.titulo) {
      onAtualizar(tarefa.id, { titulo: tituloEdit.trim() });
    }
  }

  function salvarDescricao() {
    if (descricaoEdit !== (tarefa.descricao || "")) {
      onAtualizar(tarefa.id, { descricao: descricaoEdit });
    }
  }

  function salvarData() {
    const nova = dataVencimentoEdit || "";
    if (nova !== (tarefa.dataVencimento || "")) {
      onAtualizar(tarefa.id, { dataVencimento: nova });
    }
  }

  function toggleEtiquetaLocal(etq: { nome: string; cor: string }) {
    const existe = etiquetasEdit.some((e) => e.nome === etq.nome);
    const novas = existe
      ? etiquetasEdit.filter((e) => e.nome !== etq.nome)
      : [...etiquetasEdit, etq];
    setEtiquetasEdit(novas);
    onAtualizar(tarefa.id, { etiquetas: novas });
  }

  function handleNovaSubtarefaLocal() {
    if (!subtarefaInput.trim()) return;
    onNovaSubtarefa(subtarefaInput.trim());
    setSubtarefaInput("");
  }

  const tempoDecorrido = timerRodando && timerAtivo
    ? Math.floor((Date.now() - new Date(timerAtivo.startTime).getTime()) / 1000)
    : 0;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onFechar} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-2xl bg-white shadow-2xl border-l border-gray-200 flex flex-col overflow-hidden">
        {/* Topo */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="text-emerald-600 font-semibold">Financeiro</span>
            <span>/</span>
            <span className="text-gray-800">{tarefa.titulo}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Seletor rápido de status */}
            <select
              value={tarefa.statusId}
              onChange={(e) => onAtualizar(tarefa.id, { statusId: e.target.value })}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              {[...colunas].sort((a: any, b: any) => a.ordem - b.ordem).map((s: any) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
            <button onClick={onFechar} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
              <Icone d="M6 18L18 6M6 6l12 12" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col lg:flex-row">
            {/* Lado esquerdo — conteúdo principal */}
            <div className="flex-1 p-6 pb-24">
              {/* Título editável */}
              <input
                type="text"
                value={tituloEdit}
                onChange={(e) => setTituloEdit(e.target.value)}
                onBlur={salvarTitulo}
                onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
                className="w-full text-xl font-bold text-gray-800 border-none outline-none focus:ring-0 p-0 mb-6 bg-transparent"
              />

              {/* Descrição */}
              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Descrição</label>
                <textarea
                  value={descricaoEdit}
                  onChange={(e) => setDescricaoEdit(e.target.value)}
                  onBlur={salvarDescricao}
                  rows={4}
                  placeholder="Adicione uma descrição..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Subtarefas */}
              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Subtarefas {subtarefas.length > 0 && `(${subtarefas.filter((st) => {
                    const stStatus = colunas.find((s: any) => s.id === st.statusId);
                    return stStatus?.nome === "CONCLUÍDO";
                  }).length}/${subtarefas.length})`}
                </label>
                <div className="space-y-1.5 mb-3">
                  {subtarefas.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Nenhuma subtarefa</p>
                  )}
                  {subtarefas.map((st) => {
                    const stConcluido = colunas.find((s: any) => s.id === st.statusId)?.nome === "CONCLUÍDO";
                    return (
                      <div key={st.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 group">
                        <input
                          type="checkbox"
                          checked={stConcluido}
                          onChange={() => onAlternarSubtarefa(st, !stConcluido)}
                          className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className={`text-sm flex-1 ${stConcluido ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {st.titulo}
                        </span>
                        <button
                          onClick={() => onDeletar(st.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition p-0.5"
                        >
                          <Icone d="M6 18L18 6M6 6l12 12" className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={subtarefaInput}
                    onChange={(e) => setSubtarefaInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleNovaSubtarefaLocal(); }}
                    placeholder="Adicionar subtarefa..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                  <button
                    onClick={handleNovaSubtarefaLocal}
                    disabled={!subtarefaInput.trim()}
                    className="text-xs font-semibold bg-emerald-500 text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>

            {/* Lado direito — sidebar do drawer */}
            <div className="lg:w-72 p-6 border-t lg:border-t-0 lg:border-l border-gray-100 bg-gray-50/50 space-y-5">
              {/* Valor do orçamento */}
              {valor !== undefined && valor > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Valor</label>
                  <p className="text-lg font-bold text-emerald-600">{formatarValor(valor)}</p>
                </div>
              )}

              {/* Data de vencimento */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Data de Vencimento</label>
                <input
                  type="date"
                  value={dataVencimentoEdit}
                  onChange={(e) => setDataVencimentoEdit(e.target.value)}
                  onBlur={salvarData}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              {/* Responsáveis */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Responsáveis</label>
                {tarefa.responsaveis.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Nenhum responsável</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {tarefa.responsaveis.map((r) => (
                      <span key={r} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-lg">{r}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Etiquetas */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Etiquetas</label>
                <div className="flex flex-wrap gap-1">
                  {CORES_ETIQUETA.map((etq) => {
                    const ativa = etiquetasEdit.some((e) => e.nome === etq.nome);
                    return (
                      <button
                        key={etq.nome}
                        type="button"
                        onClick={() => toggleEtiquetaLocal(etq)}
                        className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition ${
                          ativa
                            ? "text-white border-transparent"
                            : "text-gray-500 border-gray-200 bg-white hover:border-gray-300"
                        }`}
                        style={ativa ? { backgroundColor: etq.cor } : undefined}
                      >
                        {etq.nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Tracking */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tempo</label>
                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-800">
                      {timerRodando
                        ? formatarTempo(tempoDecorrido)
                        : tarefa.timeTracking.totalSeconds > 0
                          ? formatarTempo(tarefa.timeTracking.totalSeconds)
                          : "—"
                      }
                    </p>
                    {tarefa.timeTracking.totalSeconds > 0 && !timerRodando && (
                      <p className="text-[10px] text-gray-400 mt-0.5">tempo total registrado</p>
                    )}
                  </div>
                  <button
                    onClick={() => onTimer(tarefa.id)}
                    className={`w-full mt-2 text-xs font-semibold py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                      timerRodando
                        ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                        : "bg-green-50 text-green-600 hover:bg-green-100 border border-green-200"
                    }`}
                  >
                    {timerRodando ? (
                      <><Icone d="M10 9v6m4-6v6" className="w-3.5 h-3.5" /> Parar</>
                    ) : (
                      <><Icone d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" className="w-3.5 h-3.5" /> Iniciar</>
                    )}
                  </button>
                  {tarefa.timeTracking.logs.filter((l) => l.endTime).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 max-h-24 overflow-y-auto space-y-1">
                      {tarefa.timeTracking.logs.filter((l) => l.endTime).slice(-5).reverse().map((log) => (
                        <div key={log.id} className="flex items-center justify-between text-[10px] text-gray-500">
                          <span>{new Date(log.startTime).toLocaleDateString("pt-BR")}</span>
                          <span className="font-medium">{formatarTempo(log.durationSeconds)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Campos customizados */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Campos Personalizados</label>
                {Object.keys(tarefa.customFields).length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Nenhum campo</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(tarefa.customFields).map(([key, value]) => (
                      <div key={key} className="bg-white rounded-lg border border-gray-100 px-3 py-2">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">{key}</p>
                        <p className="text-sm text-gray-800">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => onDeletar(tarefa.id)}
            className="text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-xl transition"
          >
            Excluir tarefa
          </button>
          <button
            onClick={onFechar}
            className="bg-gray-100 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-200 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// CALENDÁRIO
// ═══════════════════════════════════════════════════════════

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function CalendarioView({
  colunas,
  tarefas,
  mes,
  ano,
  onMesAnterior,
  onMesSeguinte,
}: {
  colunas: any[];
  tarefas: Tarefa[];
  mes: number;
  ano: number;
  onMesAnterior: () => void;
  onMesSeguinte: () => void;
}) {
  const colunaMap = new Map(colunas.map((c) => [c.id, c]));

  const cartoesPorData = new Map<string, { tarefa: Tarefa; colunaNome: string; colunaCor: string }[]>();
  for (const tarefa of tarefas) {
    if (tarefa.dataVencimento && !tarefa.parentTaskId) {
      const chave = tarefa.dataVencimento;
      if (!cartoesPorData.has(chave)) cartoesPorData.set(chave, []);
      const col = colunaMap.get(tarefa.statusId);
      cartoesPorData.get(chave)!.push({
        tarefa,
        colunaNome: col?.nome || "Desconhecido",
        colunaCor: col?.cor || "#6b7280",
      });
    }
  }

  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0);
  const diasNoMes = ultimoDia.getDate();
  const diaSemanaInicio = primeiroDia.getDay();
  const hojeStr = hoje();

  const linhas: (number | null)[][] = [];
  let linha: (number | null)[] = [];
  for (let i = 0; i < diaSemanaInicio; i++) linha.push(null);
  for (let d = 1; d <= diasNoMes; d++) {
    linha.push(d);
    if (linha.length === 7) {
      linhas.push(linha);
      linha = [];
    }
  }
  if (linha.length > 0) {
    while (linha.length < 7) linha.push(null);
    linhas.push(linha);
  }

  function formatarDataCal(dia: number) {
    return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <button onClick={onMesAnterior} className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition">
          <Icone d="M15 19l-7-7 7-7" className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-bold text-gray-800">{MESES[mes]} {ano}</h2>
        <button onClick={onMesSeguinte} className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition">
          <Icone d="M9 5l7 7-7 7" className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-7 gap-px">
          {DIAS_SEMANA.map((dia) => (
            <div key={dia} className="text-center text-xs font-semibold text-gray-500 uppercase py-2">{dia}</div>
          ))}
          {linhas.flat().map((dia, i) => {
            if (dia === null) return <div key={`empty-${i}`} className="min-h-[100px] bg-gray-50/50 rounded-lg" />;
            const dataStr = formatarDataCal(dia);
            const cartoesHoje = cartoesPorData.get(dataStr) || [];
            const ehHoje = dataStr === hojeStr;
            return (
              <div
                key={dataStr}
                className={`min-h-[100px] p-1.5 border border-gray-100 rounded-lg ${ehHoje ? "bg-emerald-50/50 border-emerald-200/50" : "bg-white"}`}
              >
                <span className={`text-xs font-bold ${ehHoje ? "text-emerald-600" : "text-gray-500"}`}>{dia}</span>
                <div className="mt-1 space-y-0.5">
                  {cartoesHoje.slice(0, 3).map((item, idx) => (
                    <div
                      key={idx}
                      className="text-[10px] font-medium px-1 py-0.5 rounded truncate text-white"
                      style={{ backgroundColor: item.colunaCor }}
                      title={`${item.tarefa.titulo} (${item.colunaNome})`}
                    >
                      {item.tarefa.titulo}
                    </div>
                  ))}
                  {cartoesHoje.length > 3 && (
                    <div className="text-[10px] text-gray-400 font-medium px-1">+{cartoesHoje.length - 3} mais</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
