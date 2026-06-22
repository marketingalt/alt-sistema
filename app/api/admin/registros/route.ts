import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkIsAdmin, getDataCounts } from "@/lib/admin";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
    }

    const counts = await getDataCounts();
    return NextResponse.json(counts);
  } catch (err) {
    console.error("Erro ao buscar registros:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
