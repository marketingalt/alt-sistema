import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { buscarOrcamento, salvarOrcamento } from "@/lib/storage";
import { uploadFile } from "@/lib/storage-file-adapter";
import type { DocumentoFornecedor } from "@/app/types";
import path from "path";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orcamento = await buscarOrcamento(id);
  if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const user = await currentUser();
  const formData = await req.formData();
  const arquivo = formData.get("arquivo") as File;
  if (!arquivo) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const bytes = await arquivo.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const docId = Math.random().toString(36).substring(2, 10);
  const ext = path.extname(arquivo.name);
  const nomeArquivo = `${docId}${ext}`;

  await uploadFile("orcamentos", id, nomeArquivo, buffer);

  const doc: DocumentoFornecedor = {
    id: docId,
    nome: arquivo.name,
    tipo: arquivo.type,
    tamanho: arquivo.size,
    caminho: nomeArquivo,
    uploadedAt: new Date().toISOString(),
    uploadedBy: user?.fullName || user?.firstName || user?.emailAddresses[0]?.emailAddress,
  };

  await salvarOrcamento({ ...orcamento, documentos: [...(orcamento.documentos || []), doc] });

  return NextResponse.json(doc);
}
