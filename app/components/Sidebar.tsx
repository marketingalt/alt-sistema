"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import Image from "next/image";
import { useState, useMemo } from "react";

type Permissao = "orcamentos" | "clientes" | "fornecedores" | "produtos" | "financeiro";

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
    label: "Orçamentos",
    href: "/orcamentos",
    permKey: "orcamentos",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
    label: "Fornecedores",
    href: "/fornecedores",
    permKey: "fornecedores",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: "Produtos",
    href: "/produtos",
    permKey: "produtos",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
];

const FINANCEIRO_SUBITENS = [
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

  const isAdmin = user?.publicMetadata?.role === "admin";

  // Permissões do usuário (admins têm todas)
  const permissoes = useMemo<Set<Permissao>>(() => {
    if (isAdmin) return new Set(["orcamentos", "clientes", "fornecedores", "produtos", "financeiro"]);
    const raw = user?.publicMetadata?.permissoes;
    if (Array.isArray(raw)) return new Set(raw as Permissao[]);
    return new Set();
  }, [isAdmin, user?.publicMetadata?.permissoes]);

  const temPermissao = (permKey?: Permissao) => {
    if (!permKey) return true; // itens sem permKey (ex: Visão Geral) sempre visíveis
    return permissoes.has(permKey);
  };

  const financeiroPermitido = temPermissao("financeiro");
  const financeiroAtivo = pathname.startsWith("/financeiro");
  const [financeiroAberto, setFinanceiroAberto] = useState(financeiroAtivo);

  const nomeExibicao = user?.publicMetadata?.nomeExibicao as string || user?.fullName || user?.firstName || user?.emailAddresses[0]?.emailAddress || "";
  const email = user?.emailAddresses[0]?.emailAddress || "";
  const foto = user?.imageUrl;

  return (
    <aside className="w-56 min-h-screen bg-black flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <span className="text-[22px] font-bold text-[#fb4d06] tracking-tight">Omini</span>
        <span className="text-[22px] font-bold text-[#fb4d06] tracking-tight ml-1.5">Alt</span>
      </div>

      {/* Usuário */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          {foto ? (
            <Image src={foto} alt={nomeExibicao} width={32} height={32} className="rounded-full shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#fb4d06] flex items-center justify-center text-xs font-bold text-white shrink-0">
              {iniciais(nomeExibicao)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{nomeExibicao}</p>
            <p className="text-xs text-gray-500 truncate">{email}</p>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {NAV.map((item) => {
          if (!temPermissao(item.permKey)) {
            // Item bloqueado — sem link, com cadeado
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 cursor-not-allowed"
              >
                <span className="relative">
                  {item.icon}
                  <span className="absolute -top-1 -right-1">
                    <IconeCadeado />
                  </span>
                </span>
                {item.label}
              </div>
            );
          }

          const ativo = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                ativo
                  ? "bg-[#fb4d06] text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}>
                {item.icon}
                {item.label}
              </div>
            </Link>
          );
        })}

        {/* Administração — apenas para admins */}
        {isAdmin && (
          <>
            <div className="mt-1">
              <Link href="/admin">
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  pathname.startsWith("/admin")
                    ? "bg-[#fb4d06] text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Administração
                </div>
              </Link>
            </div>
            <div className="mt-2 mb-1 border-t border-white/10" />
          </>
        )}

        {/* Financeiro — grupo colapsável */}
        {financeiroPermitido ? (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setFinanceiroAberto((p) => !p)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                financeiroAtivo
                  ? "text-[#fb4d06]"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="flex-1 text-left">Financeiro</span>
              <svg
                className={`w-3.5 h-3.5 shrink-0 transition-transform ${financeiroAberto ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {financeiroAberto && (
              <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 flex flex-col gap-0.5">
                {FINANCEIRO_SUBITENS.map((sub) => {
                  const ativo = pathname === sub.href || pathname.startsWith(sub.href + "/");
                  return (
                    <Link key={sub.href} href={sub.href}>
                      <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                        ativo
                          ? "bg-[#fb4d06]/15 text-[#fb4d06]"
                          : "text-gray-500 hover:bg-white/5 hover:text-white"
                      }`}>
                        {sub.icon}
                        {sub.label}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Financeiro bloqueado */
          <div className="mt-1">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 cursor-not-allowed">
              <span className="relative">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="absolute -top-1 -right-1">
                  <IconeCadeado />
                </span>
              </span>
              Financeiro
            </div>
          </div>
        )}

        {/* Novo Orçamento */}
        {temPermissao("orcamentos") ? (
          <Link href="/novo" className="mt-2">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition cursor-pointer border border-white/10 hover:border-[#fb4d06]/40">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Orçamento
            </div>
          </Link>
        ) : (
          <div className="mt-2">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 cursor-not-allowed border border-white/5">
              <span className="relative">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="absolute -top-1 -right-1">
                  <IconeCadeado />
                </span>
              </span>
              Novo Orçamento
            </div>
          </div>
        )}

        {/* Em breve */}
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
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-white/5 hover:text-red-400 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sair
        </button>
      </div>
    </aside>
  );
}
