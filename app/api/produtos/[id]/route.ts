import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { buscarProduto, salvarProduto, deletarProduto } from "@/lib/storage";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const produto = await buscarProduto(id);
  if (!produto) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(produto);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  const user = await currentUser();
  const body = await req.json();
  const salvo = await salvarProduto({
    ...body,
    id,
    updatedAt: new Date().toISOString(),
    updatedById: userId || undefined,
    updatedBy: user?.fullName || user?.firstName || undefined,
  });
  return NextResponse.json(salvo);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deletarProduto(id);
  return NextResponse.json({ ok: true });
}
