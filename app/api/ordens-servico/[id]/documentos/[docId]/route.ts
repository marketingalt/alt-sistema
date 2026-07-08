import { NextRequest, NextResponse } from "next/server";
import { buscarOrdemServico, salvarOrdemServico } from "@/lib/storage";
import { readFile, deleteFile } from "@/lib/storage-file-adapter";

type Params = { params: Promise<{ id: string; docId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id, docId } = await params;
    const os = await buscarOrdemServico(id);
    if (!os) return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });

    const doc = os.documentos?.find((d) => d.id === docId);
    if (!doc) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

    const buffer = await readFile("ordens-servico", id, doc.caminho);
    const inline = req.nextUrl.searchParams.get("inline") === "1";
    return new Response(new Blob([buffer], { type: doc.tipo || "application/octet-stream" }), {
      headers: {
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.nome)}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OS DOCUMENTOS GET ERROR]", msg);
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id, docId } = await params;
    const os = await buscarOrdemServico(id);
    if (!os) return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });

    const doc = os.documentos?.find((d) => d.id === docId);
    if (doc) {
      await deleteFile("ordens-servico", id, doc.caminho);
    }

    await salvarOrdemServico({
      ...os,
      documentos: (os.documentos || []).filter((d) => d.id !== docId),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OS DOCUMENTOS DELETE ERROR]", msg);
    return NextResponse.json({ error: `Erro ao deletar arquivo: ${msg}` }, { status: 500 });
  }
}
