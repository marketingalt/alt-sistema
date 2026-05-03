import { NextRequest, NextResponse } from "next/server";
import { buscarCliente, salvarCliente } from "@/lib/storage";
import fs from "fs";
import path from "path";

type P = { params: Promise<{ id: string; docId: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  const { id, docId } = await params;
  const cliente = buscarCliente(id);
  const doc = cliente?.documentos?.find((d) => d.id === docId);
  if (!doc) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const filePath = path.join(process.cwd(), "data", "uploads", "clientes", id, doc.caminho);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });

  return new NextResponse(fs.readFileSync(filePath), {
    headers: {
      "Content-Type": doc.tipo || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.nome)}"`,
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id, docId } = await params;
  const cliente = buscarCliente(id);
  if (!cliente) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const doc = cliente.documentos?.find((d) => d.id === docId);
  if (doc) {
    const filePath = path.join(process.cwd(), "data", "uploads", "clientes", id, doc.caminho);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  salvarCliente({ ...cliente, documentos: (cliente.documentos || []).filter((d) => d.id !== docId) });
  return NextResponse.json({ ok: true });
}
