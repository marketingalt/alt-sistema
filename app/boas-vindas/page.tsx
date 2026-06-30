"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import SistemaLogo from "@/app/components/SistemaLogo";

type Modulo = "orcamentos" | "clientes" | "fornecedores" | "produtos" | "planejamento" | "financeiro" | "logistica" | "rh";

interface ModuloInfo {
  key: Modulo;
  label: string;
  descricao: string;
  icone: string; // SVG path
}

const MODULOS: ModuloInfo[] = [
  {
    key: "orcamentos",
    label: "Orçamentos",
    descricao: "Criar, editar e gerenciar orçamentos comerciais",
    icone: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    key: "clientes",
    label: "Clientes",
    descricao: "Gerenciar cadastro e documentos de clientes",
    icone: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    key: "fornecedores",
    label: "Fornecedores",
    descricao: "Gerenciar cadastro de fornecedores e documentos",
    icone: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  {
    key: "produtos",
    label: "Produtos",
    descricao: "Gerenciar catálogo de produtos e preços",
    icone: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  },
  {
    key: "planejamento",
    label: "Planejamento",
    descricao: "Gerenciar projetos e tarefas no Kanban",
    icone: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    key: "financeiro",
    label: "Financeiro",
    descricao: "Fluxo de caixa, contas a pagar, contas a receber",
    icone: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    key: "logistica",
    label: "Logística",
    descricao: "Gerenciar logística, transportes e entregas",
    icone: "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0",
  },
  {
    key: "rh",
    label: "RH",
    descricao: "Gerenciar documentos e processos de RH",
    icone: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  },
];

export default function BoasVindasPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [nome, setNome] = useState("");
  const [selecionados, setSelecionados] = useState<Set<Modulo>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // ── Se já completou onboarding, redireciona ──
  useEffect(() => {
    if (!isLoaded) return;
    if (user?.publicMetadata?.onboarding) {
      router.replace("/");
    }
  }, [isLoaded, user, router]);

  // Pré-selecionar todos os módulos para admins
  useEffect(() => {
    if (!isLoaded || !user) return;
    const isAdmin = user.publicMetadata?.role === "admin";
    if (isAdmin) {
      setSelecionados(new Set(MODULOS.map((m) => m.key)));
    }
  }, [isLoaded, user]);

  function toggle(modulo: Modulo) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(modulo)) {
        novo.delete(modulo);
      } else {
        novo.add(modulo);
      }
      return novo;
    });
    setErro("");
  }

  async function concluir() {
    // Validação
    if (!nome.trim()) {
      setErro("Informe seu nome para continuar.");
      return;
    }
    if (selecionados.size === 0) {
      setErro("Selecione pelo menos um módulo para acessar.");
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      const res = await fetch("/api/admin/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeExibicao: nome.trim(),
          permissoes: Array.from(selecionados),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Erro ao salvar configurações.");
        setSalvando(false);
        return;
      }

      // ── Aguarda a propagação dos metadados no Clerk ──
      setErro("Salvo! Aguardando confirmação...");

      // Cookie de fallback para o middleware enquanto o Clerk propaga
      try {
        document.cookie = "onboarding_complete=true; path=/; max-age=31536000; SameSite=Lax";
      } catch {}

      for (let tentativa = 0; tentativa < 30; tentativa++) {
        await user?.reload();
        if (user?.publicMetadata?.onboarding === true) {
          window.location.href = "/";
          return;
        }
        // Espera 500ms antes da próxima tentativa
        await new Promise((r) => setTimeout(r, 500));
      }

      // Se após 30 tentativas (~15s) ainda não propagou, redireciona mesmo assim
      // O middleware vai usar o cookie como fallback
      window.location.href = "/";
    } catch {
      setErro("Erro de rede. Tente novamente.");
      setSalvando(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full">
        {/* Logo */}
        <div className="text-center mb-10">
          <SistemaLogo
            width={180}
            height={50}
            className="mx-auto object-contain"
          />
        </div>

        <div className="bg-gray-900 rounded-3xl border border-white/10 p-8">
          {/* Cabeçalho */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-[#fb4d06]/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#fb4d06]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Boas-vindas! 🎉
            </h1>
            <p className="text-gray-400 text-sm">
              Antes de começar, personalize sua experiência no sistema.
            </p>
          </div>

          {/* Nome */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Como prefere ser chamado?
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => { setNome(e.target.value); setErro(""); }}
              placeholder="Seu nome"
              maxLength={60}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/40 focus:border-[#fb4d06] transition"
              autoFocus
            />
          </div>

          {/* Módulos */}
          <div className="mb-8">
            <p className="text-sm font-medium text-gray-300 mb-3">
              Quais módulos você quer acessar?
            </p>
            <div className="grid grid-cols-1 gap-2.5">
              {MODULOS.map((mod) => {
                const selecionado = selecionados.has(mod.key);
                return (
                  <button
                    key={mod.key}
                    type="button"
                    onClick={() => toggle(mod.key)}
                    disabled={user?.publicMetadata?.role === "admin"}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition ${
                      selecionado
                        ? "bg-[#fb4d06]/10 border-[#fb4d06]/40 text-white"
                        : "bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                    } ${user?.publicMetadata?.role === "admin" ? "opacity-80 cursor-default" : "cursor-pointer"}`}
                  >
                    {/* Ícone */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      selecionado
                        ? "bg-[#fb4d06]/20"
                        : "bg-gray-700/50"
                    }`}>
                      <svg className={`w-4.5 h-4.5 ${selecionado ? "text-[#fb4d06]" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={mod.icone} />
                      </svg>
                    </div>

                    {/* Texto */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${selecionado ? "text-white" : "text-gray-300"}`}>
                        {mod.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{mod.descricao}</p>
                    </div>

                    {/* Checkbox */}
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                      selecionado
                        ? "bg-[#fb4d06] border-[#fb4d06]"
                        : "border-gray-600 bg-transparent"
                    }`}>
                      {selecionado && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {/* Atenção de admin */}
                    {user?.publicMetadata?.role === "admin" && (
                      <span className="text-[10px] text-[#fb4d06]/60 font-medium whitespace-nowrap">
                        Admin
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div className="mb-6 p-3 rounded-xl bg-red-900/30 border border-red-800/40 text-sm text-red-400 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {erro}
            </div>
          )}

          {/* Botão */}
          <button
            onClick={concluir}
            disabled={salvando}
            className="w-full bg-[#fb4d06] text-white font-bold py-3 px-6 rounded-xl hover:bg-[#e04400] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? "Salvando..." : "Concluir"}
          </button>
        </div>
      </div>
    </div>
  );
}
