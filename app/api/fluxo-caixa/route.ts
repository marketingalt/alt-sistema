import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";

interface FluxoCaixaDB {
  lancamentos: any[];
  saldoInicial?: number;
  saldoInicialData?: string;
}

async function ler(): Promise<FluxoCaixaDB> {
  return dbGet<FluxoCaixaDB>("fluxo-caixa", { lancamentos: [] });
}
async function salvar(dados: FluxoCaixaDB) {
  await dbSet("fluxo-caixa", dados);
}

export async function GET() {
  return NextResponse.json(await ler());
}

export async function POST(req: Request) {
  const dados = await ler();
  const body = await req.json();
  const novo = {
    ...body,
    id: `fc${Date.now()}`,
    createdAt: new Date().toISOString().split("T")[0],
  };
  dados.lancamentos.push(novo);
  await salvar(dados);
  return NextResponse.json(novo, { status: 201 });
}

export async function PUT(req: Request) {
  const dados = await ler();
  const body = await req.json();
  if (body.saldoInicial !== undefined) {
    dados.saldoInicial = body.saldoInicial;
    dados.saldoInicialData = body.saldoInicialData;
    await salvar(dados);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nenhum campo válido" }, { status: 400 });
}
