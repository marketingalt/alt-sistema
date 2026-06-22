import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";

interface FaturamentosDB {
  registros: any[];
}

async function ler(): Promise<FaturamentosDB> {
  return dbGet<FaturamentosDB>("faturamentos", { registros: [] });
}
async function salvar(d: FaturamentosDB) {
  await dbSet("faturamentos", d);
}

export async function PUT(req: Request, { params }: { params: Promise<{ orcamentoId: string }> }) {
  const { orcamentoId } = await params;
  const body = await req.json();
  const dados = await ler();
  const updatedAt = new Date().toISOString().split("T")[0];

  const idx = dados.registros.findIndex(
    (r: { id?: string; orcamentoId?: string }) =>
      r.id === orcamentoId || r.orcamentoId === orcamentoId
  );

  if (idx >= 0) {
    dados.registros[idx] = { ...dados.registros[idx], ...body, updatedAt };
  } else {
    dados.registros.push({ orcamentoId, ...body, updatedAt });
  }

  await salvar(dados);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ orcamentoId: string }> }) {
  const { orcamentoId } = await params;
  const dados = await ler();
  dados.registros = dados.registros.filter(
    (r: { id?: string; orcamentoId?: string }) =>
      r.id !== orcamentoId && r.orcamentoId !== orcamentoId
  );
  await salvar(dados);
  return NextResponse.json({ ok: true });
}
