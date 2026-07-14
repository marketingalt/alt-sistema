import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";

interface FluxoCaixaDB {
  lancamentos: any[];
}

interface ContasPagarDB {
  contas: any[];
}

async function ler(): Promise<FluxoCaixaDB> {
  return dbGet<FluxoCaixaDB>("fluxo-caixa", { lancamentos: [] });
}
async function salvar(d: FluxoCaixaDB) {
  await dbSet("fluxo-caixa", d);
}
async function lerCP(): Promise<ContasPagarDB> {
  return dbGet<ContasPagarDB>("contas-a-pagar", { contas: [] });
}
async function salvarCP(d: ContasPagarDB) {
  await dbSet("contas-a-pagar", d);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dados = await ler();
  const body = await req.json();

  // Encontra o lançamento atual antes da edição
  const lancamentoAtual = dados.lancamentos.find(
    (l: { id: string }) => l.id === id
  );

  // Se está mudando a contaPagarId, desvincula a antiga e vincula a nova
  if (body.contaPagarId !== undefined && lancamentoAtual) {
    const dadosCP = await lerCP();
    const antigaId = lancamentoAtual.contaPagarId;
    const novaId = body.contaPagarId;

    // Desvincula conta antiga (volta pra pendente)
    if (antigaId && antigaId !== novaId) {
      dadosCP.contas = dadosCP.contas.map((c: any) =>
        c.id === antigaId
          ? { ...c, status: "pendente", dataPagamento: undefined, fluxoCaixaId: undefined }
          : c
      );
    }

    // Vincula conta nova (marca como paga) se for negativa
    if (novaId && lancamentoAtual.valor < 0) {
      const novaConta = dadosCP.contas.find((c: any) => c.id === novaId);
      if (novaConta && novaConta.status !== "pago") {
        dadosCP.contas = dadosCP.contas.map((c: any) =>
          c.id === novaId
            ? { ...c, status: "pago", dataPagamento: body.data || lancamentoAtual.data, fluxoCaixaId: id }
            : c
        );
      }
    }

    await salvarCP(dadosCP);
  }

  dados.lancamentos = dados.lancamentos.map((l: any) =>
    l.id === id
      ? {
          ...l,
          ...body,
          valor: body.valor !== undefined ? Math.round(Number(body.valor) * 100) / 100 : l.valor,
          comprovanteUrl: body.comprovanteUrl === undefined ? l.comprovanteUrl : body.comprovanteUrl,
        }
      : l
  );
  const atualizado = dados.lancamentos.find((l: { id: string }) => l.id === id);

  // Sincroniza comprovanteUrl com a conta a pagar vinculada
  if (atualizado?.contaPagarId && atualizado?.comprovanteUrl !== undefined) {
    const dadosCP = await lerCP();
    dadosCP.contas = dadosCP.contas.map((c: any) =>
      c.id === atualizado.contaPagarId
        ? { ...c, fluxoComprovanteUrl: atualizado.comprovanteUrl }
        : c
    );
    await salvarCP(dadosCP);
  }

  await salvar(dados);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dados = await ler();
  const lancamento = dados.lancamentos.find(
    (l: { id: string }) => l.id === id
  );

  // Se tinha conta vinculada, volta pra pendente
  if (lancamento?.contaPagarId) {
    const dadosCP = await lerCP();
    dadosCP.contas = dadosCP.contas.map((c: any) =>
      c.id === lancamento.contaPagarId
        ? { ...c, status: "pendente", dataPagamento: undefined, fluxoCaixaId: undefined, fluxoComprovanteUrl: undefined }
        : c
    );
    await salvarCP(dadosCP);
  }

  dados.lancamentos = dados.lancamentos.filter(
    (l: { id: string }) => l.id !== id
  );
  await salvar(dados);
  return NextResponse.json({ ok: true });
}
