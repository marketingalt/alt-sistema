import { NextRequest, NextResponse } from "next/server";
import { buscarOrcamento, salvarOrcamento, deletarOrcamento, listarOrcamentos } from "@/lib/storage";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orcamento = await buscarOrcamento(id);
  if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(orcamento, { headers: NO_CACHE_HEADERS });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const dados = await req.json();
    const salvo = await salvarOrcamento({ ...dados, id });
    return NextResponse.json(salvo, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[PUT ORCAMENTO ERROR]", msg);
    return NextResponse.json({ error: `Erro ao salvar: ${msg}` }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orcamento = await buscarOrcamento(id);
  if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const patch = await req.json();
  const salvo = await salvarOrcamento({ ...orcamento, ...patch });
  return NextResponse.json(salvo, { headers: NO_CACHE_HEADERS });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orcamento = await buscarOrcamento(id);
    if (!orcamento) {
      return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
    }
    await deletarOrcamento(id);
    return NextResponse.json({ ok: true }, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro ao deletar orçamento:", msg);
    return NextResponse.json({ error: `Erro ao deletar: ${msg}` }, { status: 500 });
  }
}
