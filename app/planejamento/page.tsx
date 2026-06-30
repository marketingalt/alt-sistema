"use client";

import { useState, useEffect, useCallback } from "react";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import type { Projeto, CartaoKanban, ColunaKanban } from "@/app/types";

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

// ── Paletas de cores para projetos ──

const CORES_PROJETO = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#fb4d06", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
];

const CORES_ETIQUETA = [
  { nome: "Urgente", cor: "#ef4444" },
  { nome: "Importante", cor: "#f97316" },
  { nome: "Em andamento", cor: "#3b82f6" },
  { nome: "Revisão", cor: "#a855f7" },
  { nome: "Concluído", cor: "#22c55e" },
];

// ── Ícone reutilizável ──

function Icone({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════

export default function PlanejamentoPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [boardAberto, setBoardAberto] = useState<string | null>(null);
  const [visao, setVisao] = useState<"kanban" | "calendario">("kanban");
  const [mesCalendario, setMesCalendario] = useState(() => new Date().getMonth());
  const [anoCalendario, setAnoCalendario] = useState(() => new Date().getFullYear());

  async function carregar() {
    try {
      const res = await fetch("/api/planejamento");
      if (res.ok) setProjetos(await res.json());
    } catch { /* fallback silencioso */ }
    finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); }, []);

  const projetoAtivo = boardAberto ? projetos.find((p) => p.id === boardAberto) : null;

  async function salvarProjetos(projetosAtualizados: Projeto[]) {
    setProjetos(projetosAtualizados);
    if (!projetoAtivo) return;
    const atualizado = projetosAtualizados.find((p) => p.id === projetoAtivo.id);
    if (!atualizado) return;
    await fetch("/api/planejamento", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: atualizado.id, projeto: atualizado }),
    });
  }

  // ── Novo projeto ──

  function handleNovoProjeto() {
    const nome = prompt("Nome do projeto:");
    if (!nome?.trim()) return;
    const cor = CORES_PROJETO[Math.floor(Math.random() * CORES_PROJETO.length)];
    fetch("/api/planejamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nome.trim(), cor }),
    }).then((r) => { if (r.ok) carregar(); });
  }

  // ── Deletar projeto ──

  async function handleDeletarProjeto(id: string) {
    if (!confirm("Tem certeza que deseja excluir este projeto?")) return;
    await fetch(`/api/planejamento?id=${id}`, { method: "DELETE" });
    if (boardAberto === id) setBoardAberto(null);
    await carregar();
  }

  // ── Gerenciar colunas ──

  function handleAdicionarColuna() {
    if (!projetoAtivo) return;
    const nome = prompt("Nome da coluna:");
    if (!nome?.trim()) return;
    const atualizados = projetos.map((p) => {
      if (p.id !== projetoAtivo.id) return p;
      return {
        ...p,
        colunas: [...p.colunas, { id: gerarId(), nome: nome.trim(), cartoes: [] }],
      };
    });
    salvarProjetos(atualizados);
  }

  function handleDeletarColuna(colunaId: string) {
    if (!projetoAtivo || projetoAtivo.colunas.length <= 1) return;
    if (!confirm("Excluir esta coluna e todos os seus cartões?")) return;
    const atualizados = projetos.map((p) => {
      if (p.id !== projetoAtivo.id) return p;
      return { ...p, colunas: p.colunas.filter((c) => c.id !== colunaId) };
    });
    salvarProjetos(atualizados);
  }

  // ── Gerenciar cartões ──

  function handleNovoCartao(colunaId: string) {
    if (!projetoAtivo) return;
    const titulo = prompt("Título do cartão:");
    if (!titulo?.trim()) return;
    const atualizados = projetos.map((p) => {
      if (p.id !== projetoAtivo.id) return p;
      return {
        ...p,
        colunas: p.colunas.map((c) => {
          if (c.id !== colunaId) return c;
          return {
            ...c,
            cartoes: [
              ...c.cartoes,
              {
                id: gerarId(),
                titulo: titulo.trim(),
                descricao: "",
                dataVencimento: "",
                etiquetas: [],
                membros: [],
                createdAt: hoje(),
              } as CartaoKanban,
            ],
          };
        }),
      };
    });
    salvarProjetos(atualizados);
  }

  function handleDeletarCartao(colunaId: string, cartaoId: string) {
    if (!projetoAtivo || !confirm("Excluir este cartão?")) return;
    const atualizados = projetos.map((p) => {
      if (p.id !== projetoAtivo.id) return p;
      return {
        ...p,
        colunas: p.colunas.map((c) => {
          if (c.id !== colunaId) return c;
          return { ...c, cartoes: c.cartoes.filter((ct) => ct.id !== cartaoId) };
        }),
      };
    });
    salvarProjetos(atualizados);
  }

  // ── Editar cartão (modal) ──

  const [cartaoEditando, setCartaoEditando] = useState<{
    colunaId: string;
    cartao: CartaoKanban;
  } | null>(null);

  function handleSalvarCartao(colunaId: string, cartaoAtualizado: CartaoKanban) {
    if (!projetoAtivo) return;
    const atualizados = projetos.map((p) => {
      if (p.id !== projetoAtivo.id) return p;
      return {
        ...p,
        colunas: p.colunas.map((c) => {
          if (c.id !== colunaId) return c;
          return {
            ...c,
            cartoes: c.cartoes.map((ct) =>
              ct.id === cartaoAtualizado.id ? cartaoAtualizado : ct
            ),
          };
        }),
      };
    });
    salvarProjetos(atualizados);
    setCartaoEditando(null);
  }

  // ── Drag & Drop ──

  const [dragColunaId, setDragColunaId] = useState<string | null>(null);
  const [dragOverColuna, setDragOverColuna] = useState<string | null>(null);

  function handleDragStart(cartaoId: string, colunaId: string) {
    setDragColunaId(colunaId);
    // store data for the drop target
    const ev = window.event as DragEvent;
    ev.dataTransfer?.setData("text/plain", JSON.stringify({ cartaoId, colunaId }));
  }

  function handleDragOver(colunaId: string) {
    setDragOverColuna(colunaId);
    const ev = window.event as DragEvent;
    ev.preventDefault();
  }

  function handleDragLeave() {
    setDragOverColuna(null);
  }

  function handleDrop(colunaDestinoId: string) {
    const ev = window.event as DragEvent;
    ev.preventDefault();
    setDragOverColuna(null);
    setDragColunaId(null);

    const raw = ev.dataTransfer?.getData("text/plain");
    if (!raw || !projetoAtivo) return;
    const { cartaoId, colunaId: colunaOrigemId } = JSON.parse(raw);
    if (colunaOrigemId === colunaDestinoId) return;

    const atualizados = projetos.map((p) => {
      if (p.id !== projetoAtivo.id) return p;
      let cartaoMovido: CartaoKanban | null = null;
      const novasColunas = p.colunas.map((c) => {
        if (c.id === colunaOrigemId) {
          const cartao = c.cartoes.find((ct) => ct.id === cartaoId);
          if (cartao) cartaoMovido = cartao;
          return { ...c, cartoes: c.cartoes.filter((ct) => ct.id !== cartaoId) };
        }
        return c;
      });
      if (!cartaoMovido) return p;
      return {
        ...p,
        colunas: novasColunas.map((c) => {
          if (c.id === colunaDestinoId) {
            return { ...c, cartoes: [...c.cartoes, cartaoMovido!] };
          }
          return c;
        }),
      };
    });
    salvarProjetos(atualizados);
  }

  // ── Toggle etiqueta ──

  function toggleEtiqueta(cartao: CartaoKanban, etiqueta: { nome: string; cor: string }) {
    const existe = cartao.etiquetas.some((e) => e.nome === etiqueta.nome);
    return existe
      ? cartao.etiquetas.filter((e) => e.nome !== etiqueta.nome)
      : [...cartao.etiquetas, etiqueta];
  }

  // ═════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800">Planejamento</h1>
            {boardAberto && projetoAtivo && (
              <button
                onClick={() => setBoardAberto(null)}
                className="text-sm text-gray-500 hover:text-[#fb4d06] transition flex items-center gap-1"
              >
                <Icone d="M15 19l-7-7 7-7" className="w-3.5 h-3.5" />
                Voltar aos projetos
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle visão */}
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

            {!boardAberto && (
              <button
                onClick={handleNovoProjeto}
                className="bg-[#fb4d06] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition flex items-center gap-1.5"
              >
                <Icone d="M12 4v16m8-8H4" className="w-4 h-4" />
                Novo Projeto
              </button>
            )}
          </div>
        </div>

        {carregando ? (
          <p className="text-gray-500 text-sm">Carregando...</p>
        ) : visao === "calendario" ? (
          <CalendarioView
            projetos={projetos}
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
        ) : boardAberto && projetoAtivo ? (
          <KanbanBoard
            projeto={projetoAtivo}
            dragColunaId={dragColunaId}
            dragOverColuna={dragOverColuna}
            onAdicionarColuna={handleAdicionarColuna}
            onDeletarColuna={handleDeletarColuna}
            onNovoCartao={handleNovoCartao}
            onDeletarCartao={handleDeletarCartao}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onEditarCartao={(colunaId, cartao) => setCartaoEditando({ colunaId, cartao })}
          />
        ) : (
          <ListaProjetos
            projetos={projetos}
            onAbrirBoard={(id) => setBoardAberto(id)}
            onDeletarProjeto={handleDeletarProjeto}
          />
        )}
      </main>

      {/* Modal de edição de cartão */}
      {cartaoEditando && (
        <ModalEditarCartao
          cartao={cartaoEditando.cartao}
          onSalvar={(c) => handleSalvarCartao(cartaoEditando.colunaId, c)}
          onFechar={() => setCartaoEditando(null)}
        />
      )}
    </WorkspaceLayout>
  );
}

// ═══════════════════════════════════════════════════════════
// LISTA DE PROJETOS
// ═══════════════════════════════════════════════════════════

function ListaProjetos({
  projetos,
  onAbrirBoard,
  onDeletarProjeto,
}: {
  projetos: Projeto[];
  onAbrirBoard: (id: string) => void;
  onDeletarProjeto: (id: string) => void;
}) {
  if (projetos.length === 0) {
    return (
      <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
        <Icone d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 mb-1">Nenhum projeto ainda</p>
        <p className="text-gray-400 text-sm">Clique em "Novo Projeto" para começar</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {projetos.map((projeto) => {
        const totalCartoes = projeto.colunas.reduce((s, c) => s + c.cartoes.length, 0);
        return (
          <div
            key={projeto.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition group cursor-pointer overflow-hidden"
            onClick={() => onAbrirBoard(projeto.id)}
          >
            <div className="h-2" style={{ backgroundColor: projeto.cor }} />
            <div className="p-5">
              <div className="flex items-start justify-between">
                <h3 className="font-bold text-gray-800">{projeto.nome}</h3>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeletarProjeto(projeto.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition p-1"
                  title="Excluir projeto"
                >
                  <Icone d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-4 h-4" />
                </button>
              </div>
              {projeto.descricao && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{projeto.descricao}</p>
              )}
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Icone d="M19 9l-7 7-7-7" className="w-3 h-3" />
                  {projeto.colunas.length} colunas
                </span>
                <span className="flex items-center gap-1">
                  <Icone d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" className="w-3 h-3" />
                  {totalCartoes} cartões
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// KANBAN BOARD
// ═══════════════════════════════════════════════════════════

function KanbanBoard({
  projeto,
  dragColunaId,
  dragOverColuna,
  onAdicionarColuna,
  onDeletarColuna,
  onNovoCartao,
  onDeletarCartao,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onEditarCartao,
}: {
  projeto: Projeto;
  dragColunaId: string | null;
  dragOverColuna: string | null;
  onAdicionarColuna: () => void;
  onDeletarColuna: (id: string) => void;
  onNovoCartao: (colunaId: string) => void;
  onDeletarCartao: (colunaId: string, cartaoId: string) => void;
  onDragStart: (cartaoId: string, colunaId: string) => void;
  onDragOver: (colunaId: string) => void;
  onDragLeave: () => void;
  onDrop: (colunaId: string) => void;
  onEditarCartao: (colunaId: string, cartao: CartaoKanban) => void;
}) {
  return (
    <div>
      {/* Cabeçalho do board */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: projeto.cor }} />
        <h2 className="text-xl font-bold text-gray-800">{projeto.nome}</h2>
        {projeto.descricao && (
          <span className="text-sm text-gray-400 hidden sm:inline">— {projeto.descricao}</span>
        )}
      </div>

      {/* Colunas */}
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]" style={{ scrollbarWidth: "thin" }}>
        {projeto.colunas.map((coluna) => (
          <div
            key={coluna.id}
            className={`flex-shrink-0 w-72 bg-gray-100/70 rounded-2xl flex flex-col transition-shadow ${
              dragOverColuna === coluna.id ? "ring-2 ring-[#fb4d06]/40 shadow-lg" : ""
            }`}
            onDragOver={() => onDragOver(coluna.id)}
            onDragLeave={onDragLeave}
            onDrop={() => onDrop(coluna.id)}
          >
            {/* Cabeçalho da coluna */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/50">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold text-gray-700 uppercase tracking-wide"
                >
                  {coluna.nome}
                </span>
                <span className="text-xs text-gray-400 bg-gray-200/50 rounded-full px-2 py-0.5 font-medium">
                  {coluna.cartoes.length}
                </span>
              </div>
              <button
                onClick={() => onDeletarColuna(coluna.id)}
                className="text-gray-400 hover:text-red-500 transition p-0.5"
                title="Excluir coluna"
              >
                <Icone d="M6 18L18 6M6 6l12 12" className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Cartões */}
            <div className="flex-1 px-3 py-3 space-y-2 overflow-y-auto">
              {coluna.cartoes.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-xs">
                  Arraste cartões para cá
                </div>
              )}
              {coluna.cartoes.map((cartao) => (
                <div
                  key={cartao.id}
                  draggable
                  onDragStart={() => onDragStart(cartao.id, coluna.id)}
                  onClick={() => onEditarCartao(coluna.id, cartao)}
                  className={`bg-white rounded-xl border border-gray-200 p-3 shadow-sm hover:shadow-md hover:border-gray-300 transition cursor-grab active:cursor-grabbing group ${
                    dragColunaId === coluna.id ? "opacity-50" : ""
                  }`}
                >
                  {/* Etiquetas */}
                  {cartao.etiquetas.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {cartao.etiquetas.map((etq) => (
                        <span
                          key={etq.nome}
                          className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: etq.cor }}
                        >
                          {etq.nome}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Título */}
                  <p className="text-sm font-semibold text-gray-800">{cartao.titulo}</p>

                  {/* Descrição preview */}
                  {cartao.descricao && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{cartao.descricao}</p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                    {cartao.dataVencimento ? (
                      <span className="flex items-center gap-1">
                        <Icone d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" className="w-3 h-3" />
                        {formatarData(cartao.dataVencimento)}
                      </span>
                    ) : <span />}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeletarCartao(coluna.id, cartao.id); }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition"
                      title="Excluir cartão"
                    >
                      <Icone d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Botão adicionar cartão */}
            <div className="px-3 pb-3">
              <button
                onClick={() => onNovoCartao(coluna.id)}
                className="w-full flex items-center justify-center gap-1 py-2 text-xs font-medium text-gray-500 hover:text-[#fb4d06] hover:bg-white/50 rounded-xl transition border border-dashed border-gray-300 hover:border-[#fb4d06]/30"
              >
                <Icone d="M12 4v16m8-8H4" className="w-3.5 h-3.5" />
                Adicionar cartão
              </button>
            </div>
          </div>
        ))}

        {/* Botão adicionar coluna */}
        <div className="flex-shrink-0 w-72">
          <button
            onClick={onAdicionarColuna}
            className="w-full h-32 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-[#fb4d06]/30 hover:text-[#fb4d06] transition bg-white/50"
          >
            <Icone d="M12 4v16m8-8H4" className="w-4 h-4" />
            Adicionar coluna
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CALENDÁRIO
// ═══════════════════════════════════════════════════════════

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function CalendarioView({
  projetos,
  mes,
  ano,
  onMesAnterior,
  onMesSeguinte,
}: {
  projetos: Projeto[];
  mes: number;
  ano: number;
  onMesAnterior: () => void;
  onMesSeguinte: () => void;
}) {
  // Coletar todos os cartões com data de vencimento
  const cartoesPorData = new Map<string, { cartao: CartaoKanban; projetoNome: string; projetoCor: string }[]>();
  for (const projeto of projetos) {
    for (const coluna of projeto.colunas) {
      for (const cartao of coluna.cartoes) {
        if (cartao.dataVencimento) {
          const chave = cartao.dataVencimento;
          if (!cartoesPorData.has(chave)) cartoesPorData.set(chave, []);
          cartoesPorData.get(chave)!.push({
            cartao,
            projetoNome: projeto.nome,
            projetoCor: projeto.cor,
          });
        }
      }
    }
  }

  // Calcular dias do mês
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0);
  const diasNoMes = ultimoDia.getDate();
  const diaSemanaInicio = primeiroDia.getDay();
  const hojeStr = hoje();

  // Linhas do calendário
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
      {/* Cabeçalho do calendário */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <button
          onClick={onMesAnterior}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
        >
          <Icone d="M15 19l-7-7 7-7" className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-bold text-gray-800">
          {MESES[mes]} {ano}
        </h2>
        <button
          onClick={onMesSeguinte}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
        >
          <Icone d="M9 5l7 7-7 7" className="w-4 h-4" />
        </button>
      </div>

      {/* Grade */}
      <div className="p-4">
        <div className="grid grid-cols-7 gap-px">
          {/* Dias da semana */}
          {DIAS_SEMANA.map((dia) => (
            <div key={dia} className="text-center text-xs font-semibold text-gray-500 uppercase py-2">
              {dia}
            </div>
          ))}

          {/* Dias do mês */}
          {linhas.flat().map((dia, i) => {
            if (dia === null) return <div key={`empty-${i}`} className="min-h-[100px] bg-gray-50/50 rounded-lg" />;
            const dataStr = formatarDataCal(dia);
            const cartoesHoje = cartoesPorData.get(dataStr) || [];
            const ehHoje = dataStr === hojeStr;
            return (
              <div
                key={dataStr}
                className={`min-h-[100px] p-1.5 border border-gray-100 rounded-lg ${
                  ehHoje ? "bg-[#fb4d06]/5 border-[#fb4d06]/20" : "bg-white"
                }`}
              >
                <span className={`text-xs font-bold ${ehHoje ? "text-[#fb4d06]" : "text-gray-500"}`}>
                  {dia}
                </span>
                <div className="mt-1 space-y-0.5">
                  {cartoesHoje.slice(0, 3).map((item, idx) => (
                    <div
                      key={idx}
                      className="text-[10px] font-medium px-1 py-0.5 rounded truncate text-white"
                      style={{ backgroundColor: item.projetoCor }}
                      title={`${item.cartao.titulo} (${item.projetoNome})`}
                    >
                      {item.cartao.titulo}
                    </div>
                  ))}
                  {cartoesHoje.length > 3 && (
                    <div className="text-[10px] text-gray-400 font-medium px-1">
                      +{cartoesHoje.length - 3} mais
                    </div>
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

// ═══════════════════════════════════════════════════════════
// MODAL DE EDIÇÃO DE CARTÃO
// ═══════════════════════════════════════════════════════════

function ModalEditarCartao({
  cartao,
  onSalvar,
  onFechar,
}: {
  cartao: CartaoKanban;
  onSalvar: (cartao: CartaoKanban) => void;
  onFechar: () => void;
}) {
  const [titulo, setTitulo] = useState(cartao.titulo);
  const [descricao, setDescricao] = useState(cartao.descricao || "");
  const [dataVencimento, setDataVencimento] = useState(cartao.dataVencimento || "");
  const [etiquetas, setEtiquetas] = useState(cartao.etiquetas);

  function handleSalvar() {
    if (!titulo.trim()) return;
    onSalvar({
      ...cartao,
      titulo: titulo.trim(),
      descricao,
      dataVencimento,
      etiquetas,
    });
  }

  function toggleEtiquetaModal(e: { nome: string; cor: string }) {
    setEtiquetas((prev) => {
      const existe = prev.some((et) => et.nome === e.nome);
      return existe ? prev.filter((et) => et.nome !== e.nome) : [...prev, e];
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onFechar}>
      <div
        className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-800 mb-4">Editar Cartão</h3>

        <div className="space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
              autoFocus
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06] resize-none"
            />
          </div>

          {/* Data de vencimento */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Data de Vencimento</label>
            <input
              type="date"
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
            />
          </div>

          {/* Etiquetas */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Etiquetas</label>
            <div className="flex flex-wrap gap-1.5">
              {CORES_ETIQUETA.map((etq) => {
                const ativa = etiquetas.some((e) => e.nome === etq.nome);
                return (
                  <button
                    key={etq.nome}
                    type="button"
                    onClick={() => toggleEtiquetaModal(etq)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
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
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={onFechar}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-100 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={!titulo.trim()}
            className="bg-[#fb4d06] text-white text-sm font-semibold px-5 py-2 rounded-xl hover:opacity-90 transition disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
