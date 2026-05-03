import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { buscarFornecedor, salvarFornecedor } from "@/lib/storage";
import type { DocumentoFornecedor } from "@/app/types";
import fs from "fs";
import path from "path";

function dirUpload(id: string) {
  const dir = path.join(process.cwd(), "data", "uploads", "fornecedores", id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fornecedor = buscarFornecedor(id);
  if (!fornecedor) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const user = await currentUser();
  const formData = await req.formData();
  const arquivo = formData.get("arquivo") as File;
  if (!arquivo) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const bytes = await arquivo.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const docId = Math.random().toString(36).substring(2, 10);
  const ext = path.extname(arquivo.name);
  const nomeArquivo = `${docId}${ext}`;
  const dir = dirUpload(id);
  fs.writeFileSync(path.join(dir, nomeArquivo), buffer);

  const doc: DocumentoFornecedor = {
    id: docId,
    nome: arquivo.name,
    tipo: arquivo.type,
    tamanho: arquivo.size,
    caminho: nomeArquivo,
    uploadedAt: new Date().toISOString(),
    uploadedBy: user?.fullName || user?.firstName || user?.emailAddresses[0]?.emailAddress,
  };

  const documentos = [...(fornecedor.documentos || []), doc];
  salvarFornecedor({ ...fornecedor, documentos });

  return NextResponse.json(doc);
}
