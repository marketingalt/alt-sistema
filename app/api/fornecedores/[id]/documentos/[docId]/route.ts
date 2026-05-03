import { NextRequest, NextResponse } from "next/server";
import { buscarFornecedor, salvarFornecedor } from "@/lib/storage";
import fs from "fs";
import path from "path";

type Params = { params: Promise<{ id: string; docId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const fornecedor = buscarFornecedor(id);
  if (!fornecedor) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const doc = fornecedor.documentos?.find((d) => d.id === docId);
  if (!doc) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

  const filePath = path.join(process.cwd(), "data", "uploads", "fornecedores", id, doc.caminho);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": doc.tipo || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.nome)}"`,
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const fornecedor = buscarFornecedor(id);
  if (!fornecedor) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const doc = fornecedor.documentos?.find((d) => d.id === docId);
  if (doc) {
    const filePath = path.join(process.cwd(), "data", "uploads", "fornecedores", id, doc.caminho);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  salvarFornecedor({
    ...fornecedor,
    documentos: (fornecedor.documentos || []).filter((d) => d.id !== docId),
  });

  return NextResponse.json({ ok: true });
}
