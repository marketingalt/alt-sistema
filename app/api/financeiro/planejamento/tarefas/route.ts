import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import type { Tarefa } from "@/app/types";

export const dynamic = "force-dynamic";

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

function agora() {
  return new Date().toISOString();
}

// ── GET /api/financeiro/planejamento/tarefas ──

export async function GET() {
  const tarefas = await dbGet<Tarefa[]>("financeiro-planejamento-tarefas", []);
  return NextResponse.json(tarefas);
}

// ── POST /api/financeiro/planejamento/tarefas ──

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { statusId, titulo, descricao, dataVencimento, etiquetas, parentTaskId, responsaveis, customFields } = body;

  if (!statusId || !titulo?.trim()) {
    return NextResponse.json({ error: "statusId e titulo são obrigatórios." }, { status: 400 });
  }

  const tarefas = await dbGet<Tarefa[]>("financeiro-planejamento-tarefas", []);

  // Calcular ordem como próximo número na coluna
  const daColuna = tarefas.filter((t) => t.statusId === statusId);
  const maxOrdem = daColuna.reduce((max, t) => Math.max(max, t.ordem), -1);

  const nova: Tarefa = {
    id: gerarId(),
    projectId: "financeiro",
    parentTaskId,
    statusId,
    titulo: titulo.trim(),
    descricao: descricao || "",
    dataVencimento: dataVencimento || "",
    etiquetas: etiquetas || [],
    responsaveis: responsaveis || [],
    ordem: maxOrdem + 1,
    customFields: customFields || {},
    timeTracking: { totalSeconds: 0, logs: [] },
    createdAt: agora(),
    updatedAt: agora(),
  };

  tarefas.push(nova);
  await dbSet("financeiro-planejamento-tarefas", tarefas);

  return NextResponse.json(nova, { status: 201 });
}

// ── PATCH /api/financeiro/planejamento/tarefas ──

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...campos } = body;

  if (!id) {
    return NextResponse.json({ error: "ID da tarefa é obrigatório." }, { status: 400 });
  }

  const tarefas = await dbGet<Tarefa[]>("financeiro-planejamento-tarefas", []);
  const idx = tarefas.findIndex((t) => t.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }

  tarefas[idx] = {
    ...tarefas[idx],
    ...campos,
    id,
    updatedAt: agora(),
  };

  await dbSet("financeiro-planejamento-tarefas", tarefas);
  return NextResponse.json(tarefas[idx]);
}

// ── DELETE /api/financeiro/planejamento/tarefas ──

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID da tarefa é obrigatório." }, { status: 400 });
  }

  const tarefas = await dbGet<Tarefa[]>("financeiro-planejamento-tarefas", []);
  // Remove a tarefa + subtarefas
  const restantes = tarefas.filter((t) => t.id !== id && t.parentTaskId !== id);

  if (restantes.length === tarefas.length) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }

  await dbSet("financeiro-planejamento-tarefas", restantes);
  return NextResponse.json({ ok: true });
}
