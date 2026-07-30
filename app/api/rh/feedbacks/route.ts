import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import type { FeedbackSessao } from "@/app/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const colaboradorId = url.searchParams.get("colaboradorId");
  let sessoes = await dbGet<FeedbackSessao[]>("rh-feedbacks", []);
  if (colaboradorId) {
    sessoes = sessoes.filter((s) => s.colaboradorId === colaboradorId);
  }
  // Mais recentes primeiro
  sessoes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json(sessoes);
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();
    const body = await req.json();

    if (!body.colaboradorId || !body.colaboradorNome) {
      return NextResponse.json({ error: "Colaborador é obrigatório" }, { status: 400 });
    }

    const sessao: FeedbackSessao = {
      id: `fb${Date.now()}`,
      colaboradorId: body.colaboradorId,
      colaboradorNome: body.colaboradorNome,
      data: body.data || new Date().toISOString().split("T")[0],
      topicoPrincipal: body.topicoPrincipal || "",
      itens: body.itens || [],
      createdAt: new Date().toISOString(),
      userId: userId || undefined,
      userName: user?.fullName || user?.firstName || undefined,
    };

    const sessoes = await dbGet<FeedbackSessao[]>("rh-feedbacks", []);
    sessoes.push(sessao);
    await dbSet("rh-feedbacks", sessoes);

    return NextResponse.json(sessao, { status: 201 });
  } catch (error) {
    console.error("[FEEDBACKS POST ERROR]", error);
    return NextResponse.json({ error: "Erro ao criar sessão" }, { status: 500 });
  }
}
