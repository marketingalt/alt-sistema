import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";

interface FluxoCaixaDB {
  lancamentos: any[];
  saldoInicial?: number;
  saldoInicialData?: string;
}

interface ContasPagarDB {
  contas: any[];
}

async function ler(): Promise<FluxoCaixaDB> {
  return dbGet<FluxoCaixaDB>("fluxo-caixa", { lancamentos: [] });
}
async function salvar(dados: FluxoCaixaDB) {
  await dbSet("fluxo-caixa", dados);
}

async function lerCP(): Promise<ContasPagarDB> {
  return dbGet<ContasPagarDB>("contas-a-pagar", { contas: [] });
}
async function salvarCP(d: ContasPagarDB) {
  await dbSet("contas-a-pagar", d);
}

export async function GET() {
  return NextResponse.json(await ler());
}

export async function POST(req: Request) {
  const dados = await ler();
  const body = await req.json();
  const dataAtual = new Date().toISOString().split("T")[0];
  const novo = {
    ...body,
    valor: Math.round(Number(body.valor) * 100) / 100,
    id: `fc${Date.now()}`,
    createdAt: dataAtual,
  };
  dados.lancamentos.push(novo);
  await salvar(dados);

  // Se for lançamento negativo com contaPagarId, marca a conta como paga
  if (body.valor < 0 && body.contaPagarId) {
    const dadosCP = await lerCP();
    const conta = dadosCP.contas.find((c: any) => c.id === body.contaPagarId);
    if (conta && conta.status !== "pago") {
      dadosCP.contas = dadosCP.contas.map((c: any) =>
        c.id === body.contaPagarId
          ? { ...c, status: "pago", dataPagamento: body.data || dataAtual, fluxoCaixaId: novo.id }
          : c
      );
      await salvarCP(dadosCP);
    }
  }

  return NextResponse.json(novo, { status: 201 });
}

export async function PUT(req: Request) {
  const dados = await ler();
  const body = await req.json();
  if (body.saldoInicial !== undefined) {
    dados.saldoInicial = Math.round(body.saldoInicial * 100) / 100;
    dados.saldoInicialData = body.saldoInicialData;
    await salvar(dados);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nenhum campo válido" }, { status: 400 });
}
