import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "faturamentos.json");
function ler() { return JSON.parse(fs.readFileSync(FILE, "utf-8")); }
function salvar(d: unknown) { fs.writeFileSync(FILE, JSON.stringify(d, null, 2), "utf-8"); }

export async function PUT(req: Request, { params }: { params: Promise<{ orcamentoId: string }> }) {
  const { orcamentoId } = await params;
  const body = await req.json();
  const dados = ler();
  const updatedAt = new Date().toISOString().split("T")[0];

  // manual entries have an `id` field; orcamento-linked use `orcamentoId`
  const idx = dados.registros.findIndex(
    (r: { id?: string; orcamentoId?: string }) =>
      r.id === orcamentoId || r.orcamentoId === orcamentoId
  );

  if (idx >= 0) {
    dados.registros[idx] = { ...dados.registros[idx], ...body, updatedAt };
  } else {
    dados.registros.push({ orcamentoId, ...body, updatedAt });
  }

  salvar(dados);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ orcamentoId: string }> }) {
  const { orcamentoId } = await params;
  const dados = ler();
  dados.registros = dados.registros.filter(
    (r: { id?: string; orcamentoId?: string }) =>
      r.id !== orcamentoId && r.orcamentoId !== orcamentoId
  );
  salvar(dados);
  return NextResponse.json({ ok: true });
}
