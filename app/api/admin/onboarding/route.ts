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

    if (!Array.isArray(permissoes)) {
      return NextResponse.json(
        { error: "Lista de permissões inválida" },
        { status: 400 }
      );
    }

    // Validar que as permissões são valores conhecidos
    const VALIDAS = ["orcamentos", "clientes", "fornecedores", "produtos", "planejamento", "financeiro", "logistica", "rh"];
    const invalidas = permissoes.filter((p: string) => !VALIDAS.includes(p));
    if (invalidas.length > 0) {
      return NextResponse.json(
        { error: `Permissões inválidas: ${invalidas.join(", ")}` },
        { status: 400 }
      );
    }

    const isAdmin = await checkIsAdmin(userId);
    const permissoesFinais = isAdmin ? VALIDAS : permissoes;

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const metadata = {
      ...(clerkUser.publicMetadata || {}),
      onboarding: true,
      nomeExibicao: nomeExibicao.trim(),
      permissoes: permissoesFinais,
    };
    await client.users.updateUser(userId, { publicMetadata: metadata });

    // Cookie como fallback para o middleware (evita loop de redirecionamento
    // enquanto o Clerk propaga os metadados)
    const response = NextResponse.json({
      ok: true,
      nomeExibicao: nomeExibicao.trim(),
      permissoes: permissoesFinais,
    });
    response.cookies.set("onboarding_complete", "true", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 ano
    });
    return response;
  } catch (err) {
    console.error("Erro ao salvar onboarding:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
