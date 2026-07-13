import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listarReembolsosDespesas, criarReembolsoDespesa, atualizarReembolsoDespesa, removerReembolsoDespesa } from "@/lib/reembolsos-despesas";
import { criarOuAtualizarLoteContaPagar } from "@/lib/reembolsos";

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
    const { data, dataVencimento, cliente, ordemServicoId, ordemServicoNumero, descricao, valor, pagamento, aprovadoPor, aprovadoPorNome, createdByName } = body;

    if (!data || !dataVencimento || !cliente || !descricao || !valor || !pagamento || !aprovadoPor) {
      return NextResponse.json({ error: "Campos obrigatórios faltando: data, dataVencimento, cliente, descricao, valor, pagamento, aprovadoPor" }, { status: 400 });
    }

    const reembolso = await criarReembolsoDespesa({
      data,
      dataVencimento,
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

    // Mapeia forma de pagamento para modalidade/banco do contas a pagar
    const pagamentoMap: Record<string, { modalidade: string; banco: string }> = {
      cartao_corporativo_c6: { modalidade: "PIX", banco: "C6 BANK" },
      cartao_corporativo_nubank: { modalidade: "PIX", banco: "NUBANK" },
      cartao_pessoal: { modalidade: "PIX", banco: "Outros" },
    };
    const { modalidade, banco } = pagamentoMap[pagamento] || { modalidade: "PIX", banco: "Outros" };

    // Cria ou atualiza lote no Contas a Pagar
    const contaPagarId = await criarOuAtualizarLoteContaPagar({
      dataVencimento,
      tipo: "despesa",
      reembolsoId: reembolso.id,
      descricao,
      valor: Number(valor),
      modalidade,
      banco,
      area: "PROJETOS",
      categoria: "CUSTOS DIRETOS DOS SERVIÇOS",
    });

    // Vincula a conta a pagar ao reembolso
    const atualizado = await atualizarReembolsoDespesa(reembolso.id, { contaPagarId });

    return NextResponse.json(atualizado || reembolso, { status: 201 });
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
