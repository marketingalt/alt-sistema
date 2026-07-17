import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { buscarCliente, salvarCliente, deletarCliente } from "@/lib/storage";

async function userFinanceiro(userId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    if (user.publicMetadata?.role === "admin") return true;
    const permissoes = (user.publicMetadata?.permissoes as string[]) || [];
    return permissoes.includes("financeiro");
  } catch { return false; }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth.protect();
  const { id } = await params;
  const c = await buscarCliente(id);
  if (!c) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (c.restritoFinanceiro) {
    const pode = await userFinanceiro(userId);
    if (!pode) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  return NextResponse.json(c);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth.protect();
  const { id } = await params;
  const dados = await req.json();

  // Verifica se o registro atual é restrito
  const atual = await buscarCliente(id);
  if (atual?.restritoFinanceiro) {
    const pode = await userFinanceiro(userId);
    if (!pode) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Apenas admin/financeiro pode alterar o campo restritoFinanceiro
  const isFinanceiro = await userFinanceiro(userId);
  if (dados.restritoFinanceiro !== undefined && !isFinanceiro) {
    delete dados.restritoFinanceiro;
  }

  return NextResponse.json(await salvarCliente({ ...dados, id }));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deletarCliente(id);
  return NextResponse.json({ ok: true });
}
