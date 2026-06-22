import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { nomeExibicao } = body;

    if (!nomeExibicao || typeof nomeExibicao !== "string" || nomeExibicao.trim().length === 0) {
      return NextResponse.json({ error: "Nome de exibição é obrigatório" }, { status: 400 });
    }

    const client = await clerkClient();
    await client.users.updateUser(userId, {
      publicMetadata: { nomeExibicao: nomeExibicao.trim() },
    });

    return NextResponse.json({ ok: true, nomeExibicao: nomeExibicao.trim() });
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
