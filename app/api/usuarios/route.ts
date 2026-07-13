import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAllUsers } from "@/lib/admin";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Qualquer usuário autenticado pode ver a lista (para aprovação)
    const usuarios = await getAllUsers();
    return NextResponse.json(usuarios);
  } catch (err) {
    console.error("Erro ao listar usuários:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
