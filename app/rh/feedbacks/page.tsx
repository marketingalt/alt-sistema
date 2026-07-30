"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import type { FeedbackSessao, FeedbackItem, FeedbackStatus } from "@/app/types";

// ── Dados de exemplo (primeira sessão) ──

const EXEMPLO_ITENS: FeedbackItem[] = [
  {
    id: "ex1",
    etapa: "1ª Etapa: Base & Autoconhecimento",
    tarefa: "Mapeamento Financeiro (Identificar despesas fixas/variáveis, entrada bruta/líquida, dívidas e recebíveis futuros).\nNota: Usar IA para pesquisa inicial.",
    prazo: "2026-08-29",
    status: "Pendente",
    notas: "",
  },
  {
    id: "ex2",
    etapa: "1ª Etapa: Base & Autoconhecimento",
    tarefa: "Preencher análise de perfil (16Personalities) enviada por email.",
    prazo: "2026-08-29",
    status: "Pendente",
    notas: "",
  },
  {
    id: "ex3",
    etapa: "2ª Etapa: Visão & Planejamento",
    tarefa: "Definição de Metas (Metas para o próximo ano e para os próximos 5 anos).",
    prazo: "",
    status: "Pendente",
    notas: "",
  },
];

const SESSOES_EXEMPLO: FeedbackSessao = {
  id: `fb${Date.now()}`,
  colaboradorId: "",
  colaboradorNome: "Colaborador Exemplo",
  data: new Date().toISOString().split("T")[0],
  topicoPrincipal: "1º One-a-One — Alinhamento Inicial",
  itens: EXEMPLO_ITENS,
  createdAt: new Date().toISOString(),
};

// ── Cores pastéis para cada etapa ──

const CORES_ETAPA: Record<string, { bg: string; border: string; badge: string }> = {
  "1ª Etapa": { bg: "bg-blue-50/60", border: "border-blue-200", badge: "bg-blue-100 text-blue-700" },
  "2ª Etapa": { bg: "bg-purple-50/60", border: "border-purple-200", badge: "bg-purple-100 text-purple-700" },
  "3ª Etapa": { bg: "bg-emerald-50/60", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700" },
  "4ª Etapa": { bg: "bg-amber-50/60", border: "border-amber-200", badge: "bg-amber-100 text-amber-700" },
};

function corEtapa(etapa: string) {
  const chave = Object.keys(CORES_ETAPA).find((k) => etapa.startsWith(k));
  return chave ? CORES_ETAPA[chave] : { bg: "bg-gray-50/60", border: "border-gray-200", badge: "bg-gray-100 text-gray-700" };
}

// ── Ícones por palavra-chave ──

function IconeTarefa(tarefa: string) {
  const lower = tarefa.toLowerCase();
  if (lower.includes("financeiro") || lower.includes("mapeamento") || lower.includes("despesa") || lower.includes("orçamento"))
    return "💰";
  if (lower.includes("meta") || lower.includes("planejamento") || lower.includes("visão"))
    return "🎯";
  if (lower.includes("perfil") || lower.includes("personalidade") || lower.includes("autoconhecimento"))
    return "🧠";
  if (lower.includes("email") || lower.includes("comunicação"))
    return "📧";
  if (lower.includes("tempo") || lower.includes("prazo") || lower.includes("agenda"))
    return "⏰";
  return "📌";
}

const STATUS_OPTIONS: FeedbackStatus[] = ["Pendente", "Em Andamento", "Concluído"];

const STATUS_CORES: Record<FeedbackStatus, string> = {
  "Pendente": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Em Andamento": "bg-blue-100 text-blue-700 border-blue-200",
  "Concluído": "bg-green-100 text-green-700 border-green-200",
};

export default function FeedbacksPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [sessoes, setSessoes] = useState<FeedbackSessao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string; email: string }[]>([]);

  // Formulário da sessão ativa
  const [sessaoAtiva, setSessaoAtiva] = useState<FeedbackSessao | null>(null);
  const [editandoSessaoId, setEditandoSessaoId] = useState<string | null>(null);

  // Campos do cabeçalho
  const [colaboradorId, setColaboradorId] = useState("");
  const [colaboradorNome, setColaboradorNome] = useState("");
  const [dataSessao, setDataSessao] = useState(new Date().toISOString().split("T")[0]);
  const [topicoPrincipal, setTopicoPrincipal] = useState("");

  // Itens editáveis
  const [itens, setItens] = useState<FeedbackItem[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  // States para nova sessão
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { router.replace("/sign-in"); return; }
    carregarDados();
  }, [isLoaded]);

  async function carregarDados() {
    setCarregando(true);
    try {
      const [resSessoes, resUsuarios] = await Promise.all([
        fetch("/api/rh/feedbacks"),
        fetch("/api/admin/usuarios"),
      ]);
      if (resSessoes.ok) {
        const data = await resSessoes.json();
        // Se não há dados, cria com o exemplo
        if (data.length === 0) {
          const res = await fetch("/api/rh/feedbacks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(SESSOES_EXEMPLO),
          });
          if (res.ok) {
            const criada = await res.json();
            setSessoes([criada]);
          }
        } else {
          setSessoes(data);
        }
      }
      if (resUsuarios.ok) {
        setUsuarios(await resUsuarios.json());
      }
    } catch {} finally {
      setCarregando(false);
    }
  }

  function novaSessao() {
    setEditandoSessaoId(null);
    setColaboradorId("");
    setColaboradorNome("");
    setDataSessao(new Date().toISOString().split("T")[0]);
    setTopicoPrincipal("");
    setItens([itemVazio()]);
    setMostrarFormulario(true);
  }

  function editarSessao(s: FeedbackSessao) {
    setEditandoSessaoId(s.id);
    setColaboradorId(s.colaboradorId);
    setColaboradorNome(s.colaboradorNome);
    setDataSessao(s.data);
    setTopicoPrincipal(s.topicoPrincipal);
    setItens(s.itens.length > 0 ? s.itens : [itemVazio()]);
    setMostrarFormulario(true);
  }

  function itemVazio(): FeedbackItem {
    return {
      id: `item${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      etapa: "",
      tarefa: "",
      prazo: "",
      status: "Pendente",
      notas: "",
    };
  }

  function adicionarItem() {
    setItens((prev) => [...prev, itemVazio()]);
  }

  function atualizarItem(itemId: string, campo: keyof FeedbackItem, valor: any) {
    setItens((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, [campo]: valor } : i))
    );
  }

  function removerItem(itemId: string) {
    setItens((prev) => prev.filter((i) => i.id !== itemId));
  }

  async function salvarSessao() {
    if (!colaboradorId || !colaboradorNome) return;
    setSalvando(true);
    try {
      const payload = {
        colaboradorId,
        colaboradorNome,
        data: dataSessao,
        topicoPrincipal,
        itens: itens.filter((i) => i.tarefa.trim()),
      };

      if (editandoSessaoId) {
        const res = await fetch(`/api/rh/feedbacks/${editandoSessaoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const atualizada = await res.json();
          setSessoes((prev) => prev.map((s) => (s.id === editandoSessaoId ? atualizada : s)));
        }
      } else {
        const res = await fetch("/api/rh/feedbacks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const criada = await res.json();
          setSessoes((prev) => [criada, ...prev]);
        }
      }
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
      setMostrarFormulario(false);
    } catch {
      alert("Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirSessao(id: string) {
    if (!confirm("Excluir esta sessão de feedback?")) return;
    await fetch(`/api/rh/feedbacks/${id}`, { method: "DELETE" });
    setSessoes((prev) => prev.filter((s) => s.id !== id));
    if (editandoSessaoId === id) setMostrarFormulario(false);
  }

  // Agrupa itens por etapa
  const itensAgrupados = useMemo(() => {
    const grupos: { etapa: string; itens: FeedbackItem[] }[] = [];
    for (const item of itens) {
      const existente = grupos.find((g) => g.etapa === item.etapa);
      if (existente) {
        existente.itens.push(item);
      } else {
        grupos.push({ etapa: item.etapa, itens: [item] });
      }
    }
    return grupos;
  }, [itens]);

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-6xl mx-auto">
        {/* ── Cabeçalho ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Feedbacks</h1>
            <div className="flex items-center gap-1 mt-3 bg-gray-100 rounded-xl p-1 w-fit">
              <Link
                href="/rh"
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition ${
                  pathname === "/rh"
                    ? "bg-white text-[#fb4d06] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Documentos
              </Link>
              <Link
                href="/rh/feedbacks"
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition ${
                  pathname.startsWith("/rh/feedbacks")
                    ? "bg-white text-[#fb4d06] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Feedbacks
              </Link>
            </div>
            <p className="text-gray-500 text-sm mt-3">Acompanhamento de One-a-One e planos de ação.</p>
          </div>
          <button
            onClick={novaSessao}
            className="bg-[#fb4d06] text-white font-semibold px-5 py-2 rounded-xl hover:opacity-90 transition flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nova Sessão
          </button>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-[#fb4d06] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Sessões existentes ── */}
            {sessoes.map((sessao) => (
              <div key={sessao.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                {/* Header da sessão */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-lg font-bold text-gray-800">{sessao.topicoPrincipal}</span>
                    <span className="text-sm bg-[#fb4d06]/10 text-[#fb4d06] px-3 py-1 rounded-full font-semibold">
                      {sessao.colaboradorNome}
                    </span>
                    <span className="text-sm text-gray-400">
                      {new Date(sessao.data + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => editarSessao(sessao)}
                      className="text-xs font-medium text-gray-400 hover:text-[#fb4d06] px-2 py-1 rounded-lg hover:bg-gray-50 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => excluirSessao(sessao.id)}
                      className="text-xs font-medium text-red-300 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition"
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                {/* Tabela de itens */}
                {sessao.itens.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Nenhum item cadastrado.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[200px]">Etapa</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarefa / Ação</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[100px]">Prazo</th>
                          <th className="text-left py-3 pl-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[250px]">Status / Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Agrupa por etapa para exibição
                          const grupos: { etapa: string; itens: FeedbackItem[] }[] = [];
                          for (const item of sessao.itens) {
                            const g = grupos.find((x) => x.etapa === item.etapa);
                            if (g) g.itens.push(item);
                            else grupos.push({ etapa: item.etapa, itens: [item] });
                          }
                          return grupos.map((grupo, gi) => (
                            <Fragment key={gi}>
                              {/* Linha de etapa — apenas na primeira iteração */}
                              {grupo.itens.map((item, ii) => {
                                const cores = corEtapa(item.etapa);
                                return (
                                  <tr
                                    key={item.id}
                                    className={`border-b border-gray-50 transition ${cores.bg}`}
                                  >
                                    {ii === 0 && (
                                      <td
                                        rowSpan={grupo.itens.length}
                                        className="py-3 pr-4 align-top"
                                      >
                                        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${cores.badge}`}>
                                          {grupo.etapa}
                                        </span>
                                      </td>
                                    )}
                                    <td className="py-3 px-4">
                                      <div className="flex items-start gap-2">
                                        <span className="text-sm shrink-0 mt-0.5">{IconeTarefa(item.tarefa)}</span>
                                        <div>
                                          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{item.tarefa}</p>
                                          {item.notas && (
                                            <p className="text-xs text-gray-400 mt-1 italic">{item.notas}</p>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      {item.prazo ? (
                                        <span className="text-sm text-gray-600 whitespace-nowrap">
                                          {new Date(item.prazo + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                                        </span>
                                      ) : (
                                        <span className="text-sm text-gray-300 italic">A definir</span>
                                      )}
                                    </td>
                                    <td className="py-3 pl-4">
                                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_CORES[item.status]}`}>
                                        {item.status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </Fragment>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

            {sessoes.length === 0 && !mostrarFormulario && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
                <svg className="w-14 h-14 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-400 font-medium">Nenhuma sessão encontrada</p>
                <p className="text-gray-300 text-sm mt-1">Crie uma nova sessão de feedback para começar.</p>
              </div>
            )}

            {/* ── Formulário de criação/edição ── */}
            {mostrarFormulario && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <h2 className="text-base font-bold text-gray-800 mb-5">
                  {editandoSessaoId ? "Editar Sessão" : "Nova Sessão de Feedback"}
                </h2>

                {/* Cabeçalho do formulário */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Colaborador</label>
                    <select
                      value={colaboradorId}
                      onChange={(e) => {
                        const idx = e.target.selectedIndex;
                        const nome = idx > 0 ? e.target.options[idx].text : "";
                        setColaboradorId(e.target.value);
                        setColaboradorNome(nome);
                      }}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                    >
                      <option value="">Selecione...</option>
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Data</label>
                    <input
                      type="date"
                      value={dataSessao}
                      onChange={(e) => setDataSessao(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Tópico Principal</label>
                    <input
                      type="text"
                      value={topicoPrincipal}
                      onChange={(e) => setTopicoPrincipal(e.target.value)}
                      placeholder="Ex: 1º One-a-One — Alinhamento Inicial"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                    />
                  </div>
                </div>

                {/* Tabela de itens editáveis */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Itens</h3>
                    <button
                      onClick={adicionarItem}
                      className="text-xs font-semibold text-[#fb4d06] hover:text-[#e04400] flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      Adicionar Item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {itens.map((item, idx) => {
                      const cores = corEtapa(item.etapa);
                      return (
                        <div key={item.id} className={`rounded-xl border ${cores.border} ${cores.bg} p-4 transition`}>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-gray-400 uppercase">Item {idx + 1}</span>
                            {itens.length > 1 && (
                              <button
                                onClick={() => removerItem(item.id)}
                                className="text-xs text-red-400 hover:text-red-600 transition"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Etapa / Categoria</label>
                              <input
                                type="text"
                                value={item.etapa}
                                onChange={(e) => atualizarItem(item.id, "etapa", e.target.value)}
                                placeholder="Ex: 1ª Etapa: Base & Autoconhecimento"
                                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Tarefa</label>
                              <textarea
                                value={item.tarefa}
                                onChange={(e) => atualizarItem(item.id, "tarefa", e.target.value)}
                                placeholder="Descreva a tarefa..."
                                rows={2}
                                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 resize-none"
                              />
                            </div>
                            <div className="flex gap-2 items-start">
                              <div className="flex-1">
                                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Prazo</label>
                                <input
                                  type="date"
                                  value={item.prazo}
                                  onChange={(e) => atualizarItem(item.id, "prazo", e.target.value)}
                                  className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Status</label>
                                <select
                                  value={item.status}
                                  onChange={(e) => atualizarItem(item.id, "status", e.target.value)}
                                  className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                                >
                                  {STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                          <div className="mt-2">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Notas / Observações</label>
                            <input
                              type="text"
                              value={item.notas}
                              onChange={(e) => atualizarItem(item.id, "notas", e.target.value)}
                              placeholder="Observações livres..."
                              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setMostrarFormulario(false)}
                    className="px-5 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={salvarSessao}
                    disabled={salvando || !colaboradorId}
                    className="px-6 py-2.5 text-sm font-semibold text-white bg-[#fb4d06] rounded-xl hover:opacity-90 transition disabled:opacity-40"
                  >
                    {salvando ? "Salvando..." : editandoSessaoId ? "Salvar Alterações" : "Criar Sessão"}
                  </button>
                  {salvo && (
                    <span className="text-xs text-green-600 font-medium">✓ Salvo!</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </WorkspaceLayout>
  );
}

// Fragment necessário para rowSpan
import { Fragment } from "react";
