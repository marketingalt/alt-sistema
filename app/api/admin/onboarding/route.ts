import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { checkIsAdmin } from "@/lib/admin";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { nomeExibicao, permissoes } = body;

    if (!nomeExibicao || typeof nomeExibicao !== "string" || nomeExibicao.trim().length === 0) {
      return NextResponse.json({ error: "Nome de exibição é obrigatório" }, { status: 400 });
    }

    if (!Array.isArray(permissoes) || permissoes.length === 0) {
      return NextResponse.json(
        { error: "Selecione pelo menos um módulo" },
        { status: 400 }
      );
    }

    // Validar que as permissões são valores conhecidos
    const VALIDAS = ["orcamentos", "clientes", "fornecedores", "produtos", "financeiro", "logistica"];
    const invalidas = permissoes.filter((p: string) => !VALIDAS.includes(p));
    if (invalidas.length > 0) {
      return NextResponse.json(
        { error: `Permissões inválidas: ${invalidas.join(", ")}` },
        { status: 400 }
      );
    }

    // Se for admin, garantir que todas as permissões estão ativas
    const isAdmin = await checkIsAdmin(userId);
    const permissoesFinais = isAdmin ? VALIDAS : permissoes;

    const client = await clerkClient();
    await client.users.updateUser(userId, {
      publicMetadata: {
        onboarding: true,
        nomeExibicao: nomeExibicao.trim(),
        permissoes: permissoesFinais,
      },
    });

    return NextResponse.json({
      ok: true,
      nomeExibicao: nomeExibicao.trim(),
      permissoes: permissoesFinais,
    });
  } catch (err) {
    console.error("Erro ao salvar onboarding:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
