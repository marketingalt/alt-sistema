import { NextRequest, NextResponse } from "next/server";
import { buscarFornecedor, salvarFornecedor } from "@/lib/storage";
import { readFile, deleteFile } from "@/lib/storage-file-adapter";

type Params = { params: Promise<{ id: string; docId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const fornecedor = await buscarFornecedor(id);
  if (!fornecedor) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const doc = fornecedor.documentos?.find((d) => d.id === docId);
  if (!doc) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

  try {
    const buffer = await readFile("fornecedores", id, doc.caminho);
    return new Response(new Blob([buffer], { type: doc.tipo || "application/octet-stream" }), {
      headers: {
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.nome)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const fornecedor = await buscarFornecedor(id);
  if (!fornecedor) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const doc = fornecedor.documentos?.find((d) => d.id === docId);
  if (doc) {
    await deleteFile("fornecedores", id, doc.caminho);
  }

  await salvarFornecedor({
    ...fornecedor,
    documentos: (fornecedor.documentos || []).filter((d) => d.id !== docId),
  });

  return NextResponse.json({ ok: true });
}
