import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";

export const dynamic = "force-dynamic";

export interface Vendedor {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  percentualComissao: number;
  metaMensal?: number;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

function gerarId() {
  return "vend" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function agora() {
  return new Date().toISOString();
}

const DB_KEY = "financeiro-vendedores";

export async function GET() {
  const lista = await dbGet<Vendedor[]>(DB_KEY, []);
  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nome, email, telefone, percentualComissao, metaMensal } = body;

  if (!nome?.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }

  const lista = await dbGet<Vendedor[]>(DB_KEY, []);
  const novo: Vendedor = {
    id: gerarId(),
    nome: nome.trim(),
    email: email || "",
    telefone: telefone || "",
    percentualComissao: parseFloat(percentualComissao) || 0,
    metaMensal: parseFloat(metaMensal) || 0,
    ativo: true,
    createdAt: agora(),
    updatedAt: agora(),
  };

  lista.push(novo);
  await dbSet(DB_KEY, lista);
  return NextResponse.json(novo, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...campos } = body;

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório." }, { status: 400 });
  }

  const lista = await dbGet<Vendedor[]>(DB_KEY, []);
  const idx = lista.findIndex((v) => v.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Vendedor não encontrado." }, { status: 404 });
  }

  lista[idx] = { ...lista[idx], ...campos, id, updatedAt: agora() };
  await dbSet(DB_KEY, lista);
  return NextResponse.json(lista[idx]);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório." }, { status: 400 });
  }

  const lista = await dbGet<Vendedor[]>(DB_KEY, []);
  const restantes = lista.filter((v) => v.id !== id);
  if (restantes.length === lista.length) {
    return NextResponse.json({ error: "Vendedor não encontrado." }, { status: 404 });
  }

  await dbSet(DB_KEY, restantes);
  return NextResponse.json({ ok: true });
}
