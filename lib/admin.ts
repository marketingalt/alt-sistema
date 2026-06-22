import { clerkClient } from "@clerk/nextjs/server";
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
}

export type Permissao = "orcamentos" | "clientes" | "fornecedores" | "produtos" | "financeiro" | "logistica" | "rh";

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
  await client.users.updateUser(userId, {
    publicMetadata: { role },
  });
}

export async function setUserPermissions(
  userId: string,
  permissoes: Permissao[]
): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUser(userId, {
    publicMetadata: { permissoes },
  });
}

export async function autoSeedAdmin(userId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    const { data: users } = await client.users.getUserList({ limit: 100 });
    const hasAdmin = users.some(
      (u) => u.publicMetadata?.role === "admin"
    );

    if (!hasAdmin) {
      await client.users.updateUser(userId, {
        publicMetadata: { role: "admin" },
      });
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
        ? ["orcamentos", "clientes", "fornecedores", "produtos", "financeiro", "logistica", "rh"]
        : Array.isArray(rawPerms) ? rawPerms.filter((p): p is Permissao =>
            ["orcamentos", "clientes", "fornecedores", "produtos", "financeiro", "logistica", "rh"].includes(p)
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

// ── Settings helpers ──────────────────────────────

const SETTINGS_PATH = path.join(process.cwd(), "data", "configuracoes.json");

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
};

export function getSystemSettings(): SystemSettings {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(CONFIGURACOES_PADRAO, null, 2));
      return CONFIGURACOES_PADRAO;
    }
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
  } catch {
    return CONFIGURACOES_PADRAO;
  }
}

export function saveSystemSettings(settings: SystemSettings): SystemSettings {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  return settings;
}

// ── Data overview helpers ──────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");

export function getDataCounts() {
  const counts: Record<string, number> = {};

  // Orçamentos
  try {
    const orcamentos = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "orcamentos.json"), "utf-8")
    );
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

  // Clientes
  try {
    const clientes = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "clientes.json"), "utf-8")
    );
    counts.clientes = Array.isArray(clientes) ? clientes.length : 0;
  } catch {
    counts.clientes = 0;
  }

  // Fornecedores
  try {
    const fornecedores = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "fornecedores.json"), "utf-8")
    );
    counts.fornecedores = Array.isArray(fornecedores) ? fornecedores.length : 0;
  } catch {
    counts.fornecedores = 0;
  }

  // Produtos
  try {
    const produtos = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "produtos.json"), "utf-8")
    );
    counts.produtos = Array.isArray(produtos) ? produtos.length : 0;
  } catch {
    counts.produtos = 0;
  }

  // Contas a pagar
  try {
    const cap = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "contas-a-pagar.json"), "utf-8")
    );
    counts.contasAPagar = cap.contas?.length || 0;
  } catch {
    counts.contasAPagar = 0;
  }

  // Contas a receber (not used yet, but let's keep structure)
  counts.contasAReceber = 0;

  // Faturamentos
  try {
    const fat = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "faturamentos.json"), "utf-8")
    );
    counts.faturamentos = fat.registros?.length || 0;
  } catch {
    counts.faturamentos = 0;
  }

  // Fluxo de caixa
  try {
    const fc = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "fluxo-caixa.json"), "utf-8")
    );
    counts.fluxoCaixaLancamentos = fc.lancamentos?.length || 0;
  } catch {
    counts.fluxoCaixaLancamentos = 0;
  }

  return counts;
}
