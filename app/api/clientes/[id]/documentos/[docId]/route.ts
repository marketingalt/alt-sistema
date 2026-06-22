import { NextRequest, NextResponse } from "next/server";
import { buscarCliente, salvarCliente } from "@/lib/storage";
import { readFile, deleteFile } from "@/lib/storage-file-adapter";

type P = { params: Promise<{ id: string; docId: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  const { id, docId } = await params;
  const cliente = await buscarCliente(id);
  const doc = cliente?.documentos?.find((d) => d.id === docId);
  if (!doc) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  try {
    const buffer = await readFile("clientes", id, doc.caminho);
    return new Response(new Blob([buffer], { type: doc.tipo || "application/octet-stream" }), {
      headers: {
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.nome)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id, docId } = await params;
  const cliente = await buscarCliente(id);
  if (!cliente) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const doc = cliente.documentos?.find((d) => d.id === docId);
  if (doc) {
    await deleteFile("clientes", id, doc.caminho);
  }
  await salvarCliente({ ...cliente, documentos: (cliente.documentos || []).filter((d) => d.id !== docId) });
  return NextResponse.json({ ok: true });
}
