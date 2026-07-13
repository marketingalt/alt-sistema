"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import Image from "next/image";
import { useState, useEffect, useMemo, useRef } from "react";

type Permissao = "orcamentos" | "clientes" | "fornecedores" | "produtos" | "financeiro" | "logistica" | "planejamento" | "rh";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permKey?: Permissao; // undefined = sempre visível
}

const NAV: NavItem[] = [
  {
    label: "Visão Geral",
    href: "/",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: "Clientes",
    href: "/clientes",
    permKey: "clientes",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "Logística",
    href: "/logistica",
    permKey: "logistica",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    ),
  },
  {
    label: "RH",
    href: "/rh",
    permKey: "rh",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const ORCAMENTOS_SUBITENS = [
  { label: "Visão Geral", href: "/orcamentos", icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
  { label: "Fornecedores", href: "/fornecedores", icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
  { label: "Produtos", href: "/produtos", icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
  { label: "Ordens de Serviço", href: "/ordens-servico", icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
];

const FINANCEIRO_SUBITENS = [
  {
    label: "Visão Geral",
    href: "/financeiro/visao-geral",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: "Fluxo de Caixa",
    href: "/financeiro/fluxo-de-caixa",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    label: "Contas a Pagar",
    href: "/financeiro/contas-a-pagar",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: "Contas a Receber",
    href: "/financeiro/contas-a-receber",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    label: "Painel de Controle",
    href: "/financeiro/painel-de-controle",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    label: "Planejamento",
    href: "/financeiro/planejamento",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    label: "Vendas e Comissões",
    href: "/financeiro/vendas-comissoes",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function iniciais(nome: string) {
  return nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

// ── Ícone de cadeado ──

function IconeCadeado() {
  return (
    <svg className="w-3 h-3 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();

  const emailPrincipal = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId
  )?.emailAddress || "";
  const isAdmin = emailPrincipal === "thiemy@altmkt.com.br" || user?.publicMetadata?.role === "admin";

  // Estado recolhido com persistência
  const [recolhido, setRecolhido] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar_recolhido") === "true";
    }
    return false;
  });

  function toggleRecolhido() {
    setRecolhido((p) => {
      const novo = !p;
      localStorage.setItem("sidebar_recolhido", String(novo));
      return novo;
    });
  }

  // Ordem dos itens do sidebar (carregada do localStorage)
  const ORDEM_PADRAO: string[] = ["visao-geral", "clientes", "logistica", "rh", "orcamentos", "planejamento", "administracao", "financeiro", "novo-orcamento"];
  const [sidebarOrdem, setSidebarOrdem] = useState<string[]>(ORDEM_PADRAO);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Garantir que todos os itens estão presentes, mesmo se salvou incompleto
        const completa = [...new Set([...parsed, ...ORDEM_PADRAO])];
        setSidebarOrdem(completa);
      }
    } catch {
      // usa padrão
    }
  }, []);

  // Permissões do usuário (admins têm todas)
  const permissoes = useMemo<Set<Permissao>>(() => {
    if (isAdmin) return new Set(["orcamentos", "clientes", "fornecedores", "produtos", "financeiro", "logistica", "planejamento", "rh"]);
    const raw = user?.publicMetadata?.permissoes;
    if (Array.isArray(raw)) return new Set(raw as Permissao[]);
    return new Set();
  }, [isAdmin, user?.publicMetadata?.permissoes]);

  const temPermissao = (permKey?: Permissao) => {
    if (!permKey) return true;
    return permissoes.has(permKey);
  };

  const financeiroPermitido = temPermissao("financeiro");
  const financeiroAtivo = pathname.startsWith("/financeiro");
  const [financeiroAberto, setFinanceiroAberto] = useState(financeiroAtivo);

  // Orçamentos — grupo colapsável
  const orcamentosPermitido = temPermissao("orcamentos") || temPermissao("fornecedores") || temPermissao("produtos");
  const orcamentosAtivo = pathname === "/orcamentos" || pathname.startsWith("/fornecedores") || pathname.startsWith("/produtos");
  const [orcamentosAberto, setOrcamentosAberto] = useState(orcamentosAtivo);

  // Planejamento — grupo colapsável com sub-itens dinâmicos
  const planejamentoPermitido = temPermissao("planejamento");
  const planejamentoAtivo = pathname.startsWith("/planejamento");
  const [planejamentoAberto, setPlanejamentoAberto] = useState(planejamentoAtivo);
  const [projetosSidebar, setProjetosSidebar] = useState<{ id: string; nome: string; cor: string }[]>([]);
  const [logoSistema, setLogoSistema] = useState<string | null>(null);
  const logoSelRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (planejamentoPermitido) {
      fetch("/api/planejamento")
        .then((r) => {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then((data) => {
          if (data?.projetos) {
            setProjetosSidebar(data.projetos.map((p: any) => ({ id: p.id, nome: p.nome, cor: p.cor || "#6366f1" })));
          }
        })
        .catch((err) => console.warn("[Sidebar] Erro ao carregar projetos:", err));
    }
  }, [planejamentoPermitido, pathname]);

  // Carrega logo do servidor (compartilhada entre todos os usuários)
  useEffect(() => {
    fetch("/api/admin/logo")
      .then((r) => r.json())
      .then((data) => { if (data.logoBase64) setLogoSistema(data.logoBase64); })
      .catch(() => {});
  }, []);

  const nomeExibicao = user?.publicMetadata?.nomeExibicao as string || user?.fullName || user?.firstName || user?.emailAddresses[0]?.emailAddress || "";
  const email = user?.emailAddresses[0]?.emailAddress || "";
  const foto = user?.imageUrl;

  return (
    <aside className={`${recolhido ? "w-16" : "w-56"} min-h-screen bg-[var(--sidebar-bg)] flex flex-col shrink-0 transition-all duration-200`}>
      {/* Logo + Botão recolher */}
      <div className={`${recolhido ? "px-3" : "px-4"} py-4 border-b border-white/10 flex items-center gap-0`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {recolhido ? (
          <img
            src={logoSistema || "/logo.png"}
            alt="Omni Alt"
            className="object-contain shrink-0 rounded"
            style={{ width: 28, height: 28 }}
            onClick={isAdmin ? () => logoSelRef.current?.click() : undefined}
            title={isAdmin ? "Clique para alterar a logo" : undefined}
            role={isAdmin ? "button" : undefined}
          />
        ) : (
          <div
            className="flex items-center cursor-pointer group relative"
            onClick={isAdmin ? () => logoSelRef.current?.click() : undefined}
            title={isAdmin ? "Clique para alterar a logo" : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSistema || "/logo.png"}
              alt="Omni Alt"
              className="object-contain shrink-0 rounded"
              style={{ width: 130, height: 36 }}
            />
            {isAdmin && (
              <div className="absolute inset-0 rounded bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5 5 5M12 5v12" />
                </svg>
              </div>
            )}
          </div>
        )}
        {/* Input oculto para upload da logo */}
        <input
          type="file"
          accept="image/*"
          ref={logoSelRef}
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
              const b64 = reader.result as string;
              try {
                const res = await fetch("/api/admin/logo", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ logoBase64: b64 }),
                });
                if (res.ok) setLogoSistema(b64);
              } catch { /* ignore */ }
            };
            reader.readAsDataURL(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={toggleRecolhido}
          title={recolhido ? "Expandir sidebar" : "Recolher sidebar"}
          className={`${recolhido ? "ml-auto mr-auto" : "ml-auto"} w-6 h-6 rounded-lg flex items-center justify-center text-gray-500 hover:bg-white/10 hover:text-white transition shrink-0`}
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${recolhido ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Usuário */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className={`flex items-center ${recolhido ? "justify-center" : "gap-3"}`}>
          {foto ? (
            <Image src={foto} alt={nomeExibicao} width={32} height={32} className="rounded-full shrink-0" title={recolhido ? nomeExibicao : undefined} />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#fb4d06] flex items-center justify-center text-xs font-bold text-white shrink-0" title={recolhido ? nomeExibicao : undefined}>
              {iniciais(nomeExibicao)}
            </div>
          )}
          {!recolhido && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{nomeExibicao}</p>
              <p className="text-xs text-gray-500 truncate">{email}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {/* Perfil — todos os usuários, sempre no topo */}
        <div className="mb-1">
          <Link href="/perfil" title={recolhido ? "Perfil" : undefined}>
            <div className={`flex items-center ${recolhido ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
              pathname.startsWith("/perfil")
                ? "bg-[#fb4d06] text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {!recolhido && <span>Perfil</span>}
            </div>
          </Link>
        </div>

        {!recolhido && <div className="mt-1 mb-1 border-t border-white/10" />}

        {/* Reembolsos — todos os usuários */}
        <div className="mb-1">
          <Link href="/reembolsos" title={recolhido ? "Reembolsos" : undefined}>
            <div className={`flex items-center ${recolhido ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
              pathname.startsWith("/reembolsos")
                ? "bg-[#fb4d06] text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {!recolhido && <span>Reembolsos</span>}
            </div>
          </Link>
        </div>

        {/* Seções dinâmicas — ordem definida pelo usuário */}
        {(() => {
          function renderNavItem(item: NavItem) {
            if (!temPermissao(item.permKey)) {
              return (
                <div key={item.href}
                  className={`flex items-center ${recolhido ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm text-gray-700 cursor-not-allowed`}
                  title={recolhido ? item.label : undefined}
                >
                  <span className="relative">
                    {item.icon}
                    <span className="absolute -top-1 -right-1"><IconeCadeado /></span>
                  </span>
                  {!recolhido && item.label}
                </div>
              );
            }
            const ativo = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} title={recolhido ? item.label : undefined}>
                <div className={`flex items-center ${recolhido ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  ativo ? "bg-[#fb4d06] text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}>
                  {item.icon}
                  {!recolhido && item.label}
                </div>
              </Link>
            );
          }

          // Normaliza sem acentos para match com sidebar_order IDs
          function normLabel(label: string) { return label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-"); }
          const navItemMap = new Map(NAV.map((i) => [normLabel(i.label), i]));

          const secoes: Record<string, () => React.ReactNode> = {
            "visao-geral": () => renderNavItem(navItemMap.get("visao-geral")!),
            "clientes": () => renderNavItem(navItemMap.get("clientes")!),
            "logistica": () => renderNavItem(navItemMap.get("logistica")!),
            "rh": () => renderNavItem(navItemMap.get("rh")!),
            "orcamentos": () => (
              orcamentosPermitido ? (
                <div key="orcamentos" className={recolhido ? "" : "mt-1"}>
                  {recolhido ? (
                    <Link href="/orcamentos" title="Orçamentos">
                      <div className={`flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${orcamentosAtivo ? "bg-[#fb4d06] text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}>
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                    </Link>
                  ) : (
                    <>
                      <button type="button" onClick={() => setOrcamentosAberto((p) => !p)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${orcamentosAtivo ? "text-[#fb4d06]" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <span className="flex-1 text-left">Orçamentos</span>
                        <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${orcamentosAberto ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {orcamentosAberto && (
                        <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 flex flex-col gap-0.5">
                          {ORCAMENTOS_SUBITENS.map((sub) => {
                            const ativo = pathname === sub.href || pathname.startsWith(sub.href + "/");
                            return (
                              <Link key={sub.href} href={sub.href}>
                                <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${ativo ? "bg-[#fb4d06]/15 text-[#fb4d06]" : "text-gray-500 hover:bg-white/5 hover:text-white"}`}>
                                  {sub.icon}{sub.label}
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div key="orcamentos" className={recolhido ? "" : "mt-1"}>
                  <div className={`flex items-center ${recolhido ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm text-gray-700 cursor-not-allowed`} title={recolhido ? "Orçamentos" : undefined}>
                    <span className="relative">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <span className="absolute -top-1 -right-1"><IconeCadeado /></span>
                    </span>
                    {!recolhido && <span>Orçamentos</span>}
                  </div>
                </div>
              )
            ),
            "planejamento": () => (
              planejamentoPermitido ? (
                <div key="planejamento" className={recolhido ? "" : "mt-1"}>
                  {recolhido ? (
                    <Link href="/planejamento" title="Planejamento">
                      <div className={`flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${planejamentoAtivo ? "bg-[#fb4d06] text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}>
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
                      </div>
                    </Link>
                  ) : (
                    <>
                      <button type="button" onClick={() => setPlanejamentoAberto((p) => !p)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${planejamentoAtivo ? "text-[#fb4d06]" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
                        <span className="flex-1 text-left">Planejamento</span>
                        <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${planejamentoAberto ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {planejamentoAberto && (
                        <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 flex flex-col gap-0.5">
                          <Link href="/planejamento">
                            <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${pathname === "/planejamento" ? "bg-[#fb4d06]/15 text-[#fb4d06]" : "text-gray-500 hover:bg-white/5 hover:text-white"}`}>
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                              Visão Geral
                            </div>
                          </Link>
                          {projetosSidebar.map((proj) => (
                            <Link key={proj.id} href={`/planejamento/${proj.id}`}>
                              <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${pathname === `/planejamento/${proj.id}` ? "bg-[#fb4d06]/15 text-[#fb4d06]" : "text-gray-500 hover:bg-white/5 hover:text-white"}`}>
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: proj.cor }} />
                                <span className="truncate">{proj.nome}</span>
                              </div>
                            </Link>
                          ))}
                          <button type="button" onClick={async () => {
                            const nome = prompt("Nome do novo projeto:");
                            if (!nome?.trim()) return;
                            const cor = ["#6366f1","#8b5cf6","#a855f7","#d946ef","#ec4899","#f43f5e","#fb4d06","#f97316","#eab308","#22c55e","#14b8a6","#06b6d4"][Math.floor(Math.random()*12)];
                            try {
                              const res = await fetch("/api/planejamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: nome.trim(), cor }) });
                              if (res.ok) {
                                const projeto = await res.json();
                                setProjetosSidebar((prev) => [...prev, { id: projeto.id, nome: projeto.nome, cor: projeto.cor || cor }]);
                                setPlanejamentoAberto(true);
                                window.location.href = `/planejamento/${projeto.id}`;
                              }
                            } catch (e) { console.error("Erro ao criar projeto:", e); }
                          }}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-[#fb4d06] hover:bg-white/5 transition cursor-pointer w-full text-left">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Novo Projeto
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div key="planejamento" className={recolhido ? "" : "mt-1"}>
                  <div className={`flex items-center ${recolhido ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm text-gray-700 cursor-not-allowed`} title={recolhido ? "Planejamento" : undefined}>
                    <span className="relative">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
                      <span className="absolute -top-1 -right-1"><IconeCadeado /></span>
                    </span>
                    {!recolhido && <span>Planejamento</span>}
                  </div>
                </div>
              )
            ),
            "administracao": () => isAdmin ? (
              <div key="administracao" className={recolhido ? "" : "mt-1"}>
                <Link href="/admin" title={recolhido ? "Administração" : undefined}>
                  <div className={`flex items-center ${recolhido ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${pathname.startsWith("/admin") ? "bg-[#fb4d06] text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}>
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {!recolhido && <span>Administração</span>}
                  </div>
                </Link>
              </div>
            ) : null,
            "financeiro": () => (
              financeiroPermitido ? (
                <div key="financeiro" className={recolhido ? "" : "mt-1"}>
                  {recolhido ? (
                    <Link href="/financeiro/contas-a-pagar" title="Financeiro">
                      <div className={`flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${financeiroAtivo ? "bg-[#fb4d06] text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}>
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                    </Link>
                  ) : (
                    <>
                      <button type="button" onClick={() => setFinanceiroAberto((p) => !p)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${financeiroAtivo ? "text-[#fb4d06]" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="flex-1 text-left">Financeiro</span>
                        <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${financeiroAberto ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {financeiroAberto && (
                        <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 flex flex-col gap-0.5">
                          {FINANCEIRO_SUBITENS.map((sub) => {
                            const ativo = pathname === sub.href || pathname.startsWith(sub.href + "/");
                            return (
                              <Link key={sub.href} href={sub.href}>
                                <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${ativo ? "bg-[#fb4d06]/15 text-[#fb4d06]" : "text-gray-500 hover:bg-white/5 hover:text-white"}`}>
                                  {sub.icon}{sub.label}
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div key="financeiro" className={recolhido ? "" : "mt-1"}>
                  <div className={`flex items-center ${recolhido ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm text-gray-700 cursor-not-allowed`} title={recolhido ? "Financeiro" : undefined}>
                    <span className="relative">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="absolute -top-1 -right-1"><IconeCadeado /></span>
                    </span>
                    {!recolhido && <span>Financeiro</span>}
                  </div>
                </div>
              )
            ),
            "novo-orcamento": () => temPermissao("orcamentos") ? (
              <Link key="novo-orcamento" href="/novo" className={recolhido ? "mt-2" : "mt-2"} title={recolhido ? "Novo Orçamento" : undefined}>
                <div className={`flex items-center ${recolhido ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition cursor-pointer border border-white/10 hover:border-[#fb4d06]/40`}>
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  {!recolhido && <span>Novo Orçamento</span>}
                </div>
              </Link>
            ) : (
              <div key="novo-orcamento" className="mt-2">
                <div className={`flex items-center ${recolhido ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm text-gray-700 cursor-not-allowed border border-white/5`} title={recolhido ? "Novo Orçamento" : undefined}>
                  <span className="relative">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    <span className="absolute -top-1 -right-1"><IconeCadeado /></span>
                  </span>
                  {!recolhido && <span>Novo Orçamento</span>}
                </div>
              </div>
            ),
          };

          return sidebarOrdem.map((id) => {
            const fn = secoes[id];
            if (!fn) return null;
            return fn();
          });
        })()}

        {/* Em breve */}
        {!recolhido && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-gray-700 px-3 mb-2 uppercase tracking-wide">Em breve</p>
            {[
              { label: "Relatórios", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
            ].map(({ label, icon }) => (
              <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 cursor-not-allowed">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                </svg>
                {label}
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Configurações */}
      <div className={`px-3 ${recolhido ? "pb-2 pt-2" : "pb-2"} border-t border-white/10`}>
        <Link href="/configuracoes" title={recolhido ? "Configurações" : undefined}>
          <div className={`flex items-center ${recolhido ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-white/5 hover:text-white transition cursor-pointer ${
            pathname === "/configuracoes" ? "bg-[#fb4d06]/15 text-[#fb4d06]" : ""
          }`}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
            {!recolhido && <span>Configurações</span>}
          </div>
        </Link>
      </div>

      {/* Logout */}
      <div className={`px-3 pb-4 ${recolhido ? "pt-2" : ""} border-t border-white/10`}>
        <button
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
          title={recolhido ? "Sair" : undefined}
          className={`w-full flex items-center ${recolhido ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-white/5 hover:text-red-400 transition`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!recolhido && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
