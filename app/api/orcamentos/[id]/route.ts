import { NextRequest, NextResponse } from "next/server";
import { buscarOrcamento, salvarOrcamento, deletarOrcamento, listarOrcamentos } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orcamento = await buscarOrcamento(id);
  if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(orcamento);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = await req.json();
  const salvo = await salvarOrcamento({ ...dados, id });
  return NextResponse.json(salvo);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orcamento = await buscarOrcamento(id);
  if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const patch = await req.json();
  const salvo = await salvarOrcamento({ ...orcamento, ...patch });
  return NextResponse.json(salvo);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orcamento = await buscarOrcamento(id);
    if (!orcamento) {
      return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
    }
    await deletarOrcamento(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro ao deletar orçamento:", msg);
    return NextResponse.json({ error: `Erro ao deletar: ${msg}` }, { status: 500 });
  }
}
