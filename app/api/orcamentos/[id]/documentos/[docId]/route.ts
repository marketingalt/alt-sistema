import { NextRequest, NextResponse } from "next/server";
import { buscarOrcamento, salvarOrcamento } from "@/lib/storage";
import fs from "fs";
import path from "path";

type Params = { params: Promise<{ id: string; docId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const orcamento = buscarOrcamento(id);
  if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const doc = orcamento.documentos?.find((d) => d.id === docId);
  if (!doc) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

  const filePath = path.join(process.cwd(), "data", "uploads", "orcamentos", id, doc.caminho);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });

  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": doc.tipo || "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.nome)}"`,
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const orcamento = buscarOrcamento(id);
  if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const doc = orcamento.documentos?.find((d) => d.id === docId);
  if (doc) {
    const filePath = path.join(process.cwd(), "data", "uploads", "orcamentos", id, doc.caminho);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  salvarOrcamento({
    ...orcamento,
    documentos: (orcamento.documentos || []).filter((d) => d.id !== docId),
  });

  return NextResponse.json({ ok: true });
}
