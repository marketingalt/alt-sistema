import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listarReembolsosDespesas, criarReembolsoDespesa, atualizarReembolsoDespesa, removerReembolsoDespesa } from "@/lib/reembolsos-despesas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const reembolsos = await listarReembolsosDespesas();
    return NextResponse.json(reembolsos);
  } catch (err) {
    console.error("[REEMBOLSOS-DESPESAS GET]", err);
    return NextResponse.json({ error: "Erro ao listar reembolsos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { data, cliente, ordemServicoId, ordemServicoNumero, descricao, valor, pagamento, aprovadoPor, aprovadoPorNome, createdByName } = body;

    if (!data || !cliente || !descricao || !valor || !pagamento || !aprovadoPor) {
      return NextResponse.json({ error: "Campos obrigatórios faltando: data, cliente, descricao, valor, pagamento, aprovadoPor" }, { status: 400 });
    }

    const reembolso = await criarReembolsoDespesa({
      data,
      cliente,
      ordemServicoId,
      ordemServicoNumero,
      descricao,
      valor: Number(valor),
      pagamento,
      aprovadoPor,
      aprovadoPorNome,
      createdBy: userId,
      createdByName: createdByName || "",
    });

    return NextResponse.json(reembolso, { status: 201 });
  } catch (err) {
    console.error("[REEMBOLSOS-DESPESAS POST]", err);
    return NextResponse.json({ error: "Erro ao criar reembolso" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...dados } = body;

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    const reembolso = await atualizarReembolsoDespesa(id, dados);
    if (!reembolso) {
      return NextResponse.json({ error: "Reembolso não encontrado" }, { status: 404 });
    }

    return NextResponse.json(reembolso);
  } catch (err) {
    console.error("[REEMBOLSOS-DESPESAS PUT]", err);
    return NextResponse.json({ error: "Erro ao atualizar reembolso" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Parâmetro id é obrigatório" }, { status: 400 });
    }

    const removido = await removerReembolsoDespesa(id);
    if (!removido) {
      return NextResponse.json({ error: "Reembolso não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[REEMBOLSOS-DESPESAS DELETE]", err);
    return NextResponse.json({ error: "Erro ao remover reembolso" }, { status: 500 });
  }
}
