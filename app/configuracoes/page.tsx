"use client";

import { useState, useEffect, useCallback } from "react";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";

// ── Itens do sidebar que podem ser reorganizados ──

interface SidebarItem {
  id: string;
  label: string;
  icon: string; // SVG path d attribute
}

const SIDEBAR_ITENS: SidebarItem[] = [
  { id: "visao-geral", label: "Visão Geral", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "clientes", label: "Clientes", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { id: "logistica", label: "Logística", icon: "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" },
  { id: "rh", label: "RH", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { id: "orcamentos", label: "Orçamentos", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id: "planejamento", label: "Planejamento", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" },
  { id: "administracao", label: "Administração", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
  { id: "financeiro", label: "Financeiro", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { id: "novo-orcamento", label: "Novo Orçamento", icon: "M12 4v16m8-8H4" },
];

const ORDEM_PADRAO = SIDEBAR_ITENS.map((i) => i.id);

function Icone({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
    </svg>
  );
}

export default function Configuracoes() {
  const [tema, setTema] = useState<"light" | "dark">("light");
  const [ordem, setOrdem] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    // Carregar tema
    const saved = localStorage.getItem("alt_theme") as "light" | "dark" | null;
    if (saved) {
      setTema(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTema("dark");
    }

    // Carregar ordem
    try {
      const savedOrdem = localStorage.getItem("sidebar_order");
      if (savedOrdem) {
        const parsed = JSON.parse(savedOrdem);
        // Garantir que todos os itens estão presentes
        const completa = [...new Set([...parsed, ...ORDEM_PADRAO])];
        setOrdem(completa);
      } else {
        setOrdem([...ORDEM_PADRAO]);
      }
    } catch {
      setOrdem([...ORDEM_PADRAO]);
    }
  }, []);

  const toggleTema = useCallback(() => {
    const novo = tema === "light" ? "dark" : "light";
    setTema(novo);
    localStorage.setItem("alt_theme", novo);
    document.documentElement.classList.toggle("dark", novo === "dark");
  }, [tema]);

  function salvarOrdem(novaOrdem: string[]) {
    setOrdem(novaOrdem);
    localStorage.setItem("sidebar_order", JSON.stringify(novaOrdem));
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  function moverItem(from: number, to: number) {
    if (to < 0 || to >= ordem.length) return;
    const nova = [...ordem];
    const [item] = nova.splice(from, 1);
    nova.splice(to, 0, item);
    salvarOrdem(nova);
  }

  function handleDragStart(e: React.DragEvent, idx: number) {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === idx) return;
    moverItem(dragIndex, idx);
    setDragIndex(idx);
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  function restaurarOrdem() {
    salvarOrdem([...ORDEM_PADRAO]);
  }

  const itensOrdenados = ordem
    .map((id) => SIDEBAR_ITENS.find((i) => i.id === id))
    .filter(Boolean) as SidebarItem[];

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
        </div>

        {/* ── Tema ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Aparência</h2>
          <p className="text-sm text-gray-500 mb-4">Alterne entre tema claro e escuro</p>
          <button
            onClick={toggleTema}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              tema === "dark" ? "bg-[#fb4d06]" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                tema === "dark" ? "translate-x-6" : "translate-x-1"
              }`}
            >
              {tema === "dark" ? (
                <svg className="w-3 h-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-3 h-3 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </span>
          </button>
          <span className="ml-3 text-sm text-gray-600 align-middle">
            {tema === "dark" ? "Modo escuro" : "Modo claro"}
          </span>
        </section>

        {/* ── Organizar Sidebar ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-gray-800">Organizar Sidebar</h2>
            <button
              onClick={restaurarOrdem}
              className="text-xs font-medium text-gray-500 hover:text-[#fb4d06] px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
            >
              Restaurar padrão
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Arraste os itens para reordenar a barra lateral
          </p>

          <div className="space-y-1">
            {itensOrdenados.map((item, idx) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all ${
                  dragIndex === idx
                    ? "border-[#fb4d06] bg-[#fb4d06]/5 shadow-md scale-[1.02]"
                    : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
                }`}
              >
                {/* Grip */}
                <svg className="w-4 h-4 shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z" />
                </svg>

                {/* Ícone do item */}
                <Icone d={item.icon} className="w-4 h-4 shrink-0 text-gray-500" />

                {/* Label */}
                <span className="text-sm font-medium text-gray-700 flex-1">{item.label}</span>

                {/* Número da posição */}
                <span className="text-xs text-gray-400 font-mono">#{idx + 1}</span>
              </div>
            ))}
          </div>

          {salvo && (
            <p className="text-xs text-green-600 mt-3 font-medium">
              Ordem salva! Recarregue a página para ver as alterações na sidebar.
            </p>
          )}
        </section>
      </main>
    </WorkspaceLayout>
  );
}
