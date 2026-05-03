import { NextRequest, NextResponse } from "next/server";
import { buscarCliente, salvarCliente, deletarCliente } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = buscarCliente(id);
  if (!c) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(c);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(salvarCliente({ ...await req.json(), id }));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deletarCliente(id);
  return NextResponse.json({ ok: true });
}
