import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { anexarComprovante, buscarReembolso } from "@/lib/reembolsos";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const formData = await req.formData();
    const arquivo = formData.get("arquivo") as File;

    if (!arquivo) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }

    const reembolso = await anexarComprovante(id, arquivo);
    if (!reembolso) {
      return NextResponse.json({ error: "Reembolso não encontrado" }, { status: 404 });
    }

    return NextResponse.json(reembolso);
  } catch (err) {
    console.error("Erro ao anexar comprovante:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
