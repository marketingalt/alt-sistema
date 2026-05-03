import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { buscarCliente, salvarCliente } from "@/lib/storage";
import type { DocumentoFornecedor } from "@/app/types";
import fs from "fs";
import path from "path";

function dirUpload(id: string) {
  const dir = path.join(process.cwd(), "data", "uploads", "clientes", id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = buscarCliente(id);
  if (!cliente) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const user = await currentUser();
  const formData = await req.formData();
  const arquivo = formData.get("arquivo") as File;
  if (!arquivo) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const bytes = await arquivo.arrayBuffer();
  const docId = Math.random().toString(36).substring(2, 10);
  const ext = path.extname(arquivo.name);
  const nomeArquivo = `${docId}${ext}`;
  fs.writeFileSync(path.join(dirUpload(id), nomeArquivo), Buffer.from(bytes));

  const doc: DocumentoFornecedor = {
    id: docId, nome: arquivo.name, tipo: arquivo.type,
    tamanho: arquivo.size, caminho: nomeArquivo,
    uploadedAt: new Date().toISOString(),
    uploadedBy: user?.fullName || user?.firstName || user?.emailAddresses[0]?.emailAddress,
  };

  salvarCliente({ ...cliente, documentos: [...(cliente.documentos || []), doc] });
  return NextResponse.json(doc);
}
