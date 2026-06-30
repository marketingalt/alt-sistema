import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import type { Projeto } from "@/app/types";

export const dynamic = "force-dynamic";

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

// ── GET /api/planejamento ──

export async function GET() {
  const projetos = await dbGet<Projeto[]>("planejamento", []);
  return NextResponse.json(projetos);
}

// ── POST /api/planejamento ──

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nome, descricao, cor } = body;

  if (!nome?.trim()) {
    return NextResponse.json({ error: "O nome do projeto é obrigatório." }, { status: 400 });
  }

  const projetos = await dbGet<Projeto[]>("planejamento", []);
  const agora = new Date().toISOString();

  const novo: Projeto = {
    id: gerarId(),
    nome: nome.trim(),
    descricao: descricao?.trim(),
    cor: cor || "#6366f1",
    colunas: [
      {
        id: gerarId(),
        nome: "A FAZER",
        cartoes: [],
      },
    ],
    createdAt: agora,
    updatedAt: agora,
  };

  projetos.push(novo);
  await dbSet("planejamento", projetos);

  return NextResponse.json(novo, { status: 201 });
}

// ── PUT /api/planejamento ──

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, projeto } = body;

  if (!id) {
    return NextResponse.json({ error: "ID do projeto é obrigatório." }, { status: 400 });
  }

  const projetos = await dbGet<Projeto[]>("planejamento", []);
  const idx = projetos.findIndex((p) => p.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  projetos[idx] = {
    ...projetos[idx],
    ...projeto,
    id, // não permite trocar o id
    updatedAt: new Date().toISOString(),
  };

  await dbSet("planejamento", projetos);
  return NextResponse.json(projetos[idx]);
}

// ── DELETE /api/planejamento ──

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID do projeto é obrigatório." }, { status: 400 });
  }

  const projetos = await dbGet<Projeto[]>("planejamento", []);
  const idx = projetos.findIndex((p) => p.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  projetos.splice(idx, 1);
  await dbSet("planejamento", projetos);

  return NextResponse.json({ ok: true });
}
