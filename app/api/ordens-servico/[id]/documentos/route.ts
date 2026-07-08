import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { buscarOrdemServico, salvarOrdemServico } from "@/lib/storage";
import { uploadFile } from "@/lib/storage-file-adapter";
import type { DocumentoFornecedor } from "@/app/types";
import path from "path";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const os = await buscarOrdemServico(id);
    if (!os) return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });

    const user = await currentUser();
    const formData = await req.formData();
    const arquivo = formData.get("arquivo") as File;
    if (!arquivo) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

    const bytes = await arquivo.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const docId = Math.random().toString(36).substring(2, 10);
    const ext = path.extname(arquivo.name);
    const nomeArquivo = `${docId}${ext}`;

    await uploadFile("ordens-servico", id, nomeArquivo, buffer);

    const doc: DocumentoFornecedor = {
      id: docId,
      nome: arquivo.name,
      tipo: arquivo.type,
      tamanho: arquivo.size,
      caminho: nomeArquivo,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user?.fullName || user?.firstName || user?.emailAddresses[0]?.emailAddress,
    };

    await salvarOrdemServico({ ...os, documentos: [...(os.documentos || []), doc] });

    return NextResponse.json(doc);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OS DOCUMENTOS UPLOAD ERROR]", msg);
    return NextResponse.json({ error: `Erro ao enviar arquivo: ${msg}` }, { status: 500 });
  }
}
