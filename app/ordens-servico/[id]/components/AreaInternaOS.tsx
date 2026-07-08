"use client";

import { useState } from "react";
import type { OrdemServico, CampoDinamicoDef, AnotacaoInterna, MaterialOS } from "@/app/types";
import CampoDinamicoRenderer from "./CampoDinamicoRenderer";

interface Props {
  os: OrdemServico;
  camposDinamicos: CampoDinamicoDef[];
  onUpdateOS: (updates: Partial<OrdemServico>) => void;
}

export default function AreaInternaOS({ os, camposDinamicos, onUpdateOS }: Props) {
  const [novaAnotacao, setNovaAnotacao] = useState("");

  // ── Campos internos dinâmicos ──────────────────────
  const camposInternos = camposDinamicos.filter((c) => c.grupo === "interno");
  const camposMateriais = camposDinamicos.filter((c) => c.grupo === "materiais");

  function getValor(campoId: string) {
    return os.camposDinamicos?.[campoId] ?? "";
  }

  function setValor(campoId: string, valor: any) {
    onUpdateOS({
      camposDinamicos: { ...(os.camposDinamicos || {}), [campoId]: valor },
    });
  }

  // ── Anotações Internas ─────────────────────────────
  function adicionarAnotacao() {
    if (!novaAnotacao.trim()) return;
    const anotacao: AnotacaoInterna = {
      id: Math.random().toString(36).substring(2, 10),
      autor: "Usuário",
      texto: novaAnotacao.trim(),
      createdAt: new Date().toISOString(),
    };
    onUpdateOS({
      anotacoesInternas: [...(os.anotacoesInternas || []), anotacao],
    });
    setNovaAnotacao("");
  }

  function removerAnotacao(id: string) {
    if (!confirm("Excluir anotação?")) return;
    onUpdateOS({
      anotacoesInternas: (os.anotacoesInternas || []).filter((a) => a.id !== id),
    });
  }

  // ── Materiais ──────────────────────────────────────
  function adicionarMaterial() {
    const nome = prompt("Nome do material:");
    if (!nome?.trim()) return;
    const material: MaterialOS = {
      id: Math.random().toString(36).substring(2, 10),
      nome: nome.trim(),
      quantidade: 1,
      separado: false,
    };
    onUpdateOS({
      materiais: [...(os.materiais || []), material],
    });
  }

  function toggleSeparado(id: string) {
    onUpdateOS({
      materiais: (os.materiais || []).map((m) =>
        m.id === id ? { ...m, separado: !m.separado } : m
      ),
    });
  }

  function atualizarQtd(id: string, qtd: number) {
    onUpdateOS({
      materiais: (os.materiais || []).map((m) =>
        m.id === id ? { ...m, quantidade: qtd } : m
      ),
    });
  }

  function removerMaterial(id: string) {
    if (!confirm("Remover material?")) return;
    onUpdateOS({
      materiais: (os.materiais || []).filter((m) => m.id !== id),
    });
  }

  // ── Responsáveis ───────────────────────────────────
  function adicionarResponsavel() {
    const processo = prompt("Nome do processo / área:");
    if (!processo?.trim()) return;
    const usuario = prompt("Nome do responsável:");
    if (!usuario?.trim()) return;
    onUpdateOS({
      responsaveis: { ...(os.responsaveis || {}), [processo.trim()]: usuario.trim() },
    });
  }

  function removerResponsavel(processo: string) {
    const novos = { ...(os.responsaveis || {}) };
    delete novos[processo];
    onUpdateOS({ responsaveis: novos });
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Área Interna</h2>
        <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          Não visível no PDF
        </span>
      </div>

      {/* Responsáveis */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Responsáveis</h3>
        {os.responsaveis && Object.keys(os.responsaveis).length > 0 ? (
          <div className="space-y-1.5 mb-3">
            {Object.entries(os.responsaveis).map(([processo, usuario]) => (
              <div
                key={processo}
                className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100"
              >
                <div className="text-sm">
                  <span className="font-semibold text-gray-700">{processo}:</span>{" "}
                  <span className="text-gray-600">{usuario}</span>
                </div>
                <button
                  onClick={() => removerResponsavel(processo)}
                  className="text-gray-400 hover:text-red-500 p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic mb-3">Nenhum responsável definido.</p>
        )}
        <button
          onClick={adicionarResponsavel}
          className="flex items-center gap-1.5 text-sm font-medium text-[#fb4d06] hover:opacity-80 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Adicionar responsável
        </button>
      </div>

      {/* Materiais */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Materiais</h3>
        {os.materiais && os.materiais.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            {os.materiais.map((mat) => (
              <div
                key={mat.id}
                className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={mat.separado}
                    onChange={() => toggleSeparado(mat.id)}
                    className="w-4 h-4 rounded border-gray-300 text-[#fb4d06] focus:ring-[#fb4d06]"
                    title="Separado"
                  />
                  <span className={`text-sm ${mat.separado ? "line-through text-gray-400" : "text-gray-700"}`}>
                    {mat.nome}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={mat.quantidade}
                    onChange={(e) => atualizarQtd(mat.id, Math.max(1, Number(e.target.value)))}
                    className="w-16 text-center text-sm border border-gray-200 rounded-lg px-1 py-1"
                  />
                  <button
                    onClick={() => removerMaterial(mat.id)}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic mb-3">Nenhum material cadastrado.</p>
        )}
        <button
          onClick={adicionarMaterial}
          className="flex items-center gap-1.5 text-sm font-medium text-[#fb4d06] hover:opacity-80 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Adicionar material
        </button>
      </div>

      {/* Campos internos dinâmicos */}
      {camposInternos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Campos Internos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {camposInternos.map((campo) => (
              <CampoDinamicoRenderer
                key={campo.id}
                campo={campo}
                valor={getValor(campo.id)}
                onChange={(v) => setValor(campo.id, v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Campos de materiais dinâmicos */}
      {camposMateriais.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Estoque</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {camposMateriais.map((campo) => (
              <CampoDinamicoRenderer
                key={campo.id}
                campo={campo}
                valor={getValor(campo.id)}
                onChange={(v) => setValor(campo.id, v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Anotações Internas */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Anotações</h3>
        <div className="space-y-2 mb-3 max-h-80 overflow-y-auto">
          {(os.anotacoesInternas || []).length === 0 ? (
            <p className="text-sm text-gray-400 italic">Nenhuma anotação.</p>
          ) : (
            [...(os.anotacoesInternas || [])].reverse().map((anotacao) => (
              <div
                key={anotacao.id}
                className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{anotacao.texto}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {anotacao.autor} — {new Date(anotacao.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <button
                    onClick={() => removerAnotacao(anotacao.id)}
                    className="text-gray-400 hover:text-red-500 p-1 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <textarea
            value={novaAnotacao}
            onChange={(e) => setNovaAnotacao(e.target.value)}
            placeholder="Nova anotação..."
            rows={2}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
          />
          <button
            onClick={adicionarAnotacao}
            disabled={!novaAnotacao.trim()}
            className="bg-[#fb4d06] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition disabled:opacity-50 self-end"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
