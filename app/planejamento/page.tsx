"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import type { Projeto, Tarefa } from "@/app/types";

// ── Helpers ──

function hoje() {
  return new Date().toISOString().split("T")[0];
}

function formatarTempo(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmt(valor: number): string {
  return valor.toLocaleString("pt-BR");
}

// ── Cores dos projetos ──

const CORES_PROJETO = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#fb4d06", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
];

function Icone({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL — Dashboard de Planejamento
// ═══════════════════════════════════════════════════════════

export default function PlanejamentoDashboard() {
  const router = useRouter();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novaCor, setNovaCor] = useState(CORES_PROJETO[0]);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setErro("");
    try {
      const res = await fetch("/api/planejamento");
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setProjetos(data.projetos);
      setTarefas(data.tarefas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar().catch(() => setCarregando(false));
  }, []);

  // Normaliza dados
  const projetosNormalizados = projetos.map((p) => ({
    ...p,
    statuses: p.statuses || [],
  }));

  // ── KPIs ──

  const totalProjetos = projetosNormalizados.length;

  const tarefasPrincipais = tarefas.filter((t) => !t.parentTaskId);
  const totalTarefas = tarefasPrincipais.length;

  const hojeStr = hoje();

  const tarefasAtrasadas = tarefasPrincipais.filter((t) => {
    if (!t.dataVencimento) return false;
    const projeto = projetosNormalizados.find((p) => p.id === t.projectId);
    if (!projeto) return false;
    const statusConcluidoId = projeto.statuses.find((s) => s.nome === "CONCLUÍDO")?.id;
    if (statusConcluidoId && t.statusId === statusConcluidoId) return false;
    return t.dataVencimento < hojeStr;
  }).length;

  const fimSemana = new Date();
  fimSemana.setDate(fimSemana.getDate() + (7 - fimSemana.getDay()));
  const fimSemanaStr = fimSemana.toISOString().split("T")[0];

  const tarefasSemana = tarefasPrincipais.filter((t) => {
    if (!t.dataVencimento) return false;
    return t.dataVencimento >= hojeStr && t.dataVencimento <= fimSemanaStr;
  }).length;

  // Briefing na casa — tarefas na primeira coluna de cada projeto
  const tarefasBriefing = tarefasPrincipais.filter((t) => {
    const projeto = projetosNormalizados.find((p) => p.id === t.projectId);
    if (!projeto) return false;
    const primeiraColuna = projeto.statuses.sort((a, b) => a.ordem - b.ordem)[0];
    return primeiraColuna && t.statusId === primeiraColuna.id;
  }).length;

  // ── Novo Projeto ──

  async function handleCriarProjeto() {
    if (!novoNome.trim()) return;
    setSalvando(true);
    try {
      const res = await fetch("/api/planejamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: novoNome.trim(),
          descricao: novaDescricao.trim(),
          cor: novaCor,
        }),
      });
      if (res.ok) {
        setModalAberto(false);
        setNovoNome("");
        setNovaDescricao("");
        setNovaCor(CORES_PROJETO[0]);
        await carregar();
      }
    } finally {
      setSalvando(false);
    }
  }

  // ── Render ──

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Planejamento</h1>
          <button
            onClick={() => setModalAberto(true)}
            className="bg-[#fb4d06] text-white text-sm font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition flex items-center gap-1.5"
          >
            <Icone d="M12 4v16m8-8H4" className="w-4 h-4" />
            Novo Projeto
          </button>
        </div>

        {/* Cards resumo */}
        {!carregando && totalProjetos > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Projetos</p>
              <p className="text-2xl font-bold text-gray-800">{totalProjetos}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Tarefas</p>
              <p className="text-2xl font-bold text-gray-800">{totalTarefas}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Briefing na casa</p>
              <p className="text-2xl font-bold text-indigo-600">{tarefasBriefing}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Atrasadas</p>
              <p className={`text-2xl font-bold ${tarefasAtrasadas > 0 ? "text-red-500" : "text-green-600"}`}>
                {tarefasAtrasadas}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Vencem esta semana</p>
              <p className="text-2xl font-bold text-[#fb4d06]">{tarefasSemana}</p>
            </div>
          </div>
        )}

        {/* Estado de carregamento */}
        {carregando && (
          <div className="text-center text-gray-400 py-20">Carregando...</div>
        )}

        {/* Estado de erro */}
        {!carregando && erro && (
          <div className="flex flex-col items-center gap-4 py-20">
            <Icone d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" className="w-12 h-12 text-red-400" />
            <p className="text-gray-500">{erro}</p>
            <button
              onClick={carregar}
              className="bg-[#fb4d06] text-white text-sm font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Nenhum projeto */}
        {!carregando && !erro && totalProjetos === 0 && (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
            <Icone d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-1">Nenhum projeto ainda</p>
            <p className="text-gray-400 text-sm">Clique em &ldquo;Novo Projeto&rdquo; para começar</p>
          </div>
        )}

        {/* Grid de projetos */}
        {!carregando && !erro && totalProjetos > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projetosNormalizados.map((projeto) => {
              const totalTarefasProjeto = tarefas.filter((t) => t.projectId === projeto.id && !t.parentTaskId).length;
              const statusConcluidoId = projeto.statuses.find((s) => s.nome === "CONCLUÍDO")?.id;
              const totalConcluidas = statusConcluidoId
                ? tarefas.filter((t) => t.projectId === projeto.id && !t.parentTaskId && t.statusId === statusConcluidoId).length
                : 0;

              return (
                <div
                  key={projeto.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition group cursor-pointer overflow-hidden"
                  onClick={() => router.push(`/planejamento/${projeto.id}`)}
                >
                  <div className="h-2" style={{ backgroundColor: projeto.cor }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-gray-800">{projeto.nome}</h3>
                    </div>
                    {projeto.descricao && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{projeto.descricao}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Icone d="M19 9l-7 7-7-7" className="w-3 h-3" />
                        {projeto.statuses.length} colunas
                      </span>
                      <span className="flex items-center gap-1">
                        <Icone d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" className="w-3 h-3" />
                        {totalTarefasProjeto} tarefas
                      </span>
                      {totalConcluidas > 0 && (
                        <span className="text-green-500 font-medium">{totalConcluidas}/{totalTarefasProjeto}</span>
                      )}
                    </div>
                    {/* Barra de progresso */}
                    {totalTarefasProjeto > 0 && (
                      <div className="mt-3 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.round((totalConcluidas / totalTarefasProjeto) * 100)}%`,
                            backgroundColor: projeto.cor,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal Novo Projeto */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalAberto(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4">Novo Projeto</h2>

            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nome</label>
                <input
                  type="text"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCriarProjeto(); }}
                  placeholder="Nome do projeto"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
                  autoFocus
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Descrição (opcional)</label>
                <textarea
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  rows={2}
                  placeholder="Breve descrição do projeto"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06] resize-none"
                />
              </div>

              {/* Cor */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {CORES_PROJETO.map((cor) => (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setNovaCor(cor)}
                      className={`w-8 h-8 rounded-full transition-all ${
                        novaCor === cor ? "ring-2 ring-offset-2 ring-[#fb4d06] scale-110" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: cor }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setModalAberto(false)}
                className="text-sm font-medium text-gray-600 bg-gray-100 px-4 py-2.5 rounded-xl hover:bg-gray-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCriarProjeto}
                disabled={!novoNome.trim() || salvando}
                className="bg-[#fb4d06] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-50"
              >
                {salvando ? "Criando..." : "Criar Projeto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
}
