import { NextRequest, NextResponse } from "next/server";
import { buscarFornecedor, salvarFornecedor, deletarFornecedor } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await buscarFornecedor(id);
  if (!f) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(f);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = await req.json();
  return NextResponse.json(await salvarFornecedor({ ...dados, id }));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deletarFornecedor(id);
  return NextResponse.json({ ok: true });
}
