import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";

interface FluxoCaixaDB {
  lancamentos: any[];
}

async function ler(): Promise<FluxoCaixaDB> {
  return dbGet<FluxoCaixaDB>("fluxo-caixa", { lancamentos: [] });
}
async function salvar(d: FluxoCaixaDB) {
  await dbSet("fluxo-caixa", d);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = await ler();
  const body = await req.json();
  dados.lancamentos = dados.lancamentos.map((l: { id: string }) =>
    l.id === id ? { ...l, ...body } : l
  );
  await salvar(dados);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = await ler();
  dados.lancamentos = dados.lancamentos.filter((l: { id: string }) => l.id !== id);
  await salvar(dados);
  return NextResponse.json({ ok: true });
}
