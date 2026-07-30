import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import type { FeedbackSessao } from "@/app/types";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const sessoes = await dbGet<FeedbackSessao[]>("rh-feedbacks", []);
    const idx = sessoes.findIndex((s) => s.id === id);

    if (idx < 0) {
      return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
    }

    sessoes[idx] = {
      ...sessoes[idx],
      ...body,
      id, // não permite trocar o id
      updatedAt: new Date().toISOString(),
    };

    await dbSet("rh-feedbacks", sessoes);
    return NextResponse.json(sessoes[idx]);
  } catch (error) {
    console.error("[FEEDBACKS PUT ERROR]", error);
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessoes = await dbGet<FeedbackSessao[]>("rh-feedbacks", []);
    const idx = sessoes.findIndex((s) => s.id === id);

    if (idx < 0) {
      return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
    }

    sessoes.splice(idx, 1);
    await dbSet("rh-feedbacks", sessoes);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[FEEDBACKS DELETE ERROR]", error);
    return NextResponse.json({ error: "Erro ao excluir" }, { status: 500 });
  }
}
