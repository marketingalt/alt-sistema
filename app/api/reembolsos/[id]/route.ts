import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { atualizarReembolso, removerReembolso, buscarReembolso } from "@/lib/reembolsos";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;

    const reembolso = await buscarReembolso(id);
    if (!reembolso) {
      return NextResponse.json({ error: "Reembolso não encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const updated = await atualizarReembolso(id, body);

    if (!updated) {
      return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Erro ao atualizar reembolso:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;

    const reembolso = await buscarReembolso(id);
    if (!reembolso) {
      return NextResponse.json({ error: "Reembolso não encontrado" }, { status: 404 });
    }

    const removido = await removerReembolso(id);
    if (!removido) {
      return NextResponse.json({ error: "Erro ao remover" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Erro ao remover reembolso:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
