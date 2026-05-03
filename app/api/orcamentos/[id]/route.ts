import { NextRequest, NextResponse } from "next/server";
import { buscarOrcamento, salvarOrcamento, deletarOrcamento } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orcamento = buscarOrcamento(id);
  if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(orcamento);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = await req.json();
  const salvo = salvarOrcamento({ ...dados, id });
  return NextResponse.json(salvo);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orcamento = buscarOrcamento(id);
  if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const patch = await req.json();
  const salvo = salvarOrcamento({ ...orcamento, ...patch });
  return NextResponse.json(salvo);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deletarOrcamento(id);
  return NextResponse.json({ ok: true });
}
