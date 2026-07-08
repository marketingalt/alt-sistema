import { NextRequest, NextResponse } from "next/server";
import { restaurarVersao } from "@/lib/storage";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; versaoId: string }> }) {
  try {
    const { id, versaoId } = await params;
    const dados = await restaurarVersao(id, versaoId);
    if (!dados) {
      return NextResponse.json({ error: "Versão não encontrada" }, { status: 404 });
    }
    return NextResponse.json(dados, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[RESTAURAR VERSAO ERROR]", msg);
    return NextResponse.json({ error: `Erro ao restaurar versão: ${msg}` }, { status: 500 });
  }
}
