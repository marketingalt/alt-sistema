import { NextRequest, NextResponse } from "next/server";
import { buscarOrcamento, salvarOrcamento } from "@/lib/storage";
import { readFile, deleteFile } from "@/lib/storage-file-adapter";

type Params = { params: Promise<{ id: string; docId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const orcamento = await buscarOrcamento(id);
  if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const doc = orcamento.documentos?.find((d) => d.id === docId);
  if (!doc) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

  try {
    const buffer = await readFile("orcamentos", id, doc.caminho);
    const inline = req.nextUrl.searchParams.get("inline") === "1";
    return new Response(new Blob([buffer], { type: doc.tipo || "application/octet-stream" }), {
      headers: {
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.nome)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const orcamento = await buscarOrcamento(id);
  if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const doc = orcamento.documentos?.find((d) => d.id === docId);
  if (doc) {
    await deleteFile("orcamentos", id, doc.caminho);
  }

  await salvarOrcamento({
    ...orcamento,
    documentos: (orcamento.documentos || []).filter((d) => d.id !== docId),
  });

  return NextResponse.json({ ok: true });
}
