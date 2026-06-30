import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import type { Projeto, Tarefa } from "@/app/types";

export const dynamic = "force-dynamic";

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

// ── GET /api/planejamento ──

export async function GET() {
  const projetos = await dbGet<Projeto[]>("planejamento", []);
  const tarefas = await dbGet<Tarefa[]>("planejamento-tarefas", []);
  return NextResponse.json({ projetos, tarefas });
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

  const statusesPadrao = [
    { id: gerarId(), nome: "A FAZER", cor: "#6b7280", ordem: 0 },
    { id: gerarId(), nome: "FAZENDO", cor: "#3b82f6", ordem: 1 },
    { id: gerarId(), nome: "REVISÃO", cor: "#a855f7", ordem: 2 },
    { id: gerarId(), nome: "CONCLUÍDO", cor: "#22c55e", ordem: 3 },
  ];

  const novo: Projeto = {
    id: gerarId(),
    nome: nome.trim(),
    descricao: descricao?.trim(),
    cor: cor || "#6366f1",
    statuses: statusesPadrao,
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
    id,
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

  // Remove projeto
  const projetos = await dbGet<Projeto[]>("planejamento", []);
  const idx = projetos.findIndex((p) => p.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }
  projetos.splice(idx, 1);
  await dbSet("planejamento", projetos);

  // Remove tarefas do projeto
  const tarefas = await dbGet<Tarefa[]>("planejamento-tarefas", []);
  const tarefasRestantes = tarefas.filter((t) => t.projectId !== id);
  await dbSet("planejamento-tarefas", tarefasRestantes);

  return NextResponse.json({ ok: true });
}
