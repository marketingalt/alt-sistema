import { NextRequest, NextResponse } from "next/server";
import { salvarVersao, listarVersoes } from "@/lib/storage";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { nome, dados } = body;
    if (!nome || !dados) {
      return NextResponse.json({ error: "Campos 'nome' e 'dados' são obrigatórios" }, { status: 400 });
    }
    const versao = await salvarVersao(id, nome, dados);
    if (!versao) {
      return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
    }
    return NextResponse.json(versao, { status: 201, headers: NO_CACHE_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST VERSAO ERROR]", msg);
    return NextResponse.json({ error: `Erro ao salvar versão: ${msg}` }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const versoes = await listarVersoes(id);
    return NextResponse.json(versoes, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET VERSOES ERROR]", msg);
    return NextResponse.json({ error: `Erro ao listar versões: ${msg}` }, { status: 500 });
  }
}
