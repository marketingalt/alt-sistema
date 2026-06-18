import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "fluxo-caixa.json");
function ler() { return JSON.parse(fs.readFileSync(FILE, "utf-8")); }
function salvar(d: unknown) { fs.writeFileSync(FILE, JSON.stringify(d, null, 2), "utf-8"); }

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = ler();
  const body = await req.json();
  dados.lancamentos = dados.lancamentos.map((l: { id: string }) =>
    l.id === id ? { ...l, ...body } : l
  );
  salvar(dados);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = ler();
  dados.lancamentos = dados.lancamentos.filter((l: { id: string }) => l.id !== id);
  salvar(dados);
  return NextResponse.json({ ok: true });
}
