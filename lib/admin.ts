import { clerkClient } from "@clerk/nextjs/server";
import { dbGet, dbSet } from "./storage-adapter";
import type { CampoDinamicoDef } from "@/app/types";
import fs from "fs";
import path from "path";

// ── Tipos ──────────────────────────────────────────

export interface SystemSettings {
  taxasPadrao: {
    honorarios: number;
    impostos: number;
    comissao: number;
    margemPadrao: number;
  };
  frete: {
    valorKm: number;
  };
  prazos: {
    pagamentoPadrao: string;
    entregaPadrao: string;
  };
  geral: {
    dominioPermitido: string;
  };
  logoBase64?: string;
  bancos?: string[];
  categorias?: string[];
  areas?: string[];
  osCamposDinamicos?: CampoDinamicoDef[];
}

export type Permissao = "orcamentos" | "clientes" | "fornecedores" | "produtos" | "financeiro" | "logistica" | "planejamento" | "rh";

export interface ClerkUserWithRole {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "user";
  permissoes: Permissao[];
  imagemUrl?: string;
  criadoEm: string;
  ultimoLogin?: string;
}

// ── Admin role helpers ──────────────────────────────

export async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    // ── Super-admin fixo: este email é sempre admin ──
    const emailPrincipal = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    )?.emailAddress || "";
    if (emailPrincipal === "thiemy@altmkt.com.br") return true;

    return user.publicMetadata?.role === "admin";
  } catch {
    return false;
  }
}

export async function setAdminRole(
  userId: string,
  role: "admin" | "user"
): Promise<void> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const metadata = { ...(user.publicMetadata || {}), role, onboarding: true };
  await client.users.updateUser(userId, { publicMetadata: metadata });
}

export async function setUserPermissions(
  userId: string,
  permissoes: Permissao[]
): Promise<void> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const metadata = { ...(user.publicMetadata || {}), permissoes, onboarding: true };
  await client.users.updateUser(userId, { publicMetadata: metadata });
}

export async function deleteUser(
  userId: string
): Promise<void> {
  const client = await clerkClient();
  await client.users.deleteUser(userId);
}

export async function autoSeedAdmin(userId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    const { data: users } = await client.users.getUserList({ limit: 100 });
    const hasAdmin = users.some(
      (u) => u.publicMetadata?.role === "admin"
    );

    if (!hasAdmin) {
      const user = await client.users.getUser(userId);
      const metadata = { ...(user.publicMetadata || {}), role: "admin", onboarding: true };
      await client.users.updateUser(userId, { publicMetadata: metadata });
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export async function getAllUsers(): Promise<ClerkUserWithRole[]> {
  const client = await clerkClient();
  const { data: users } = await client.users.getUserList({ limit: 100 });

  return users
    .filter((u) => {
      const email = u.emailAddresses[0]?.emailAddress || "";
      return email.endsWith("@altmkt.com.br");
    })
    .map((u) => {
      const role = (u.publicMetadata?.role as "admin" | "user") || "user";
      const rawPerms = u.publicMetadata?.permissoes as string[] | undefined;
      const permissoes: Permissao[] = role === "admin"
        ? ["orcamentos", "clientes", "fornecedores", "produtos", "financeiro", "logistica", "planejamento", "rh"]
        : Array.isArray(rawPerms) ? rawPerms.filter((p): p is Permissao =>
            ["orcamentos", "clientes", "fornecedores", "produtos", "financeiro", "logistica", "planejamento", "rh"].includes(p)
          ) : [];
      return {
        id: u.id,
        nome: u.fullName || u.firstName || u.username || "Sem nome",
        email: u.emailAddresses[0]?.emailAddress || "",
        role,
        permissoes,
        imagemUrl: u.imageUrl,
        criadoEm: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
        ultimoLogin: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : undefined,
      };
    });
}

export async function getAllAdmins(): Promise<ClerkUserWithRole[]> {
  const users = await getAllUsers();
  return users.filter((u) => u.role === "admin");
}

// ── Permission checking helpers ──────────────────────

export async function userHasPermissao(
  userId: string,
  permissao: Permissao
): Promise<boolean> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    // Admin tem todas as permissões
    if (user.publicMetadata?.role === "admin") return true;

    const permissoes = (user.publicMetadata?.permissoes as string[]) || [];
    return permissoes.includes(permissao);
  } catch {
    return false;
  }
}

// ── Settings helpers ──────────────────────────────

const CONFIGURACOES_PADRAO: SystemSettings = {
  taxasPadrao: {
    honorarios: 15,
    impostos: 8,
    comissao: 3,
    margemPadrao: 30,
  },
  frete: {
    valorKm: 1.5,
  },
  prazos: {
    pagamentoPadrao: "30 dias",
    entregaPadrao: "15 dias úteis",
  },
  geral: {
    dominioPermitido: "@altmkt.com.br",
  },
  bancos: ["C6 BANK", "Banco Itaú"],
  categorias: [
    "RECEITA OPERACIONAL BRUTA",
    "CUSTOS DIRETOS DOS SERVIÇOS",
    "DESPESAS ADM E GERAIS",
    "DESPESAS COM PESSOAL OPERACIONAL",
    "DESPESAS COM PESSOAL — PROLABORE",
    "DEDUÇÕES DA RECEITA (IMPOSTOS)",
    "DESPESAS COMERCIAIS",
    "RESULTADO FINANCEIRO",
    "EMPRÉSTIMO THIEMY",
    "EMPRÉSTIMO FERNANDO",
    "DEVOLUÇÃO THIEMY",
    "DEVOLUÇÃO FERNANDO",
    "ESTORNO",
  ],
  areas: ["PROJETOS", "DIGITAL", "MISTO", "ESTORNO"],
  osCamposDinamicos: [],
};

export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const settings = await dbGet<SystemSettings>("configuracoes", CONFIGURACOES_PADRAO);
    return settings;
  } catch {
    return CONFIGURACOES_PADRAO;
  }
}

export async function saveSystemSettings(settings: SystemSettings): Promise<SystemSettings> {
  await dbSet("configuracoes", settings);
  return settings;
}

// ── Data overview helpers ──────────────────────────

export async function getDataCounts() {
  const counts: Record<string, number> = {};

  try {
    const orcamentos = await dbGet<any[]>("orcamentos", []);
    counts.orcamentos = Array.isArray(orcamentos) ? orcamentos.length : 0;
    if (Array.isArray(orcamentos)) {
      counts.orcamentosAprovados = orcamentos.filter(
        (o: any) => o.status === "Aprovado"
      ).length;
      counts.orcamentosPendentes = orcamentos.filter(
        (o: any) => o.status === "Em andamento" || o.status === "Enviado"
      ).length;
    }
  } catch {
    counts.orcamentos = 0;
  }

  try {
    const clientes = await dbGet<any[]>("clientes", []);
    counts.clientes = Array.isArray(clientes) ? clientes.length : 0;
  } catch {
    counts.clientes = 0;
  }

  try {
    const fornecedores = await dbGet<any[]>("fornecedores", []);
    counts.fornecedores = Array.isArray(fornecedores) ? fornecedores.length : 0;
  } catch {
    counts.fornecedores = 0;
  }

  try {
    const produtos = await dbGet<any[]>("produtos", []);
    counts.produtos = Array.isArray(produtos) ? produtos.length : 0;
  } catch {
    counts.produtos = 0;
  }

  try {
    const cap = await dbGet<any>("contas-a-pagar", { contas: [] });
    counts.contasAPagar = cap.contas?.length || 0;
  } catch {
    counts.contasAPagar = 0;
  }

  counts.contasAReceber = 0;

  try {
    const fat = await dbGet<any>("faturamentos", { registros: [] });
    counts.faturamentos = fat.registros?.length || 0;
  } catch {
    counts.faturamentos = 0;
  }

  try {
    const fc = await dbGet<any>("fluxo-caixa", { lancamentos: [] });
    counts.fluxoCaixaLancamentos = fc.lancamentos?.length || 0;
  } catch {
    counts.fluxoCaixaLancamentos = 0;
  }

  return counts;
}
