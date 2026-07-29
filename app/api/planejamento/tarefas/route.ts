import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import { limparAnexosVinculados } from "@/lib/supabaseStorage";
import type { Tarefa } from "@/app/types";

export const dynamic = "force-dynamic";

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

function agora() {
  return new Date().toISOString();
}

// ── GET /api/planejamento/tarefas ──

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const tarefas = await dbGet<Tarefa[]>("planejamento-tarefas", []);
  const filtradas = projectId ? tarefas.filter((t) => t.projectId === projectId) : tarefas;
  return NextResponse.json(filtradas);
}

// ── POST /api/planejamento/tarefas ──

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, statusId, titulo, descricao, dataVencimento, etiquetas, parentTaskId, responsaveis, customFields } = body;

  if (!projectId || !statusId || !titulo?.trim()) {
    return NextResponse.json({ error: "projectId, statusId e titulo são obrigatórios." }, { status: 400 });
  }

  const tarefas = await dbGet<Tarefa[]>("planejamento-tarefas", []);

  // Calcular ordem como próximo número na coluna
  const daColuna = tarefas.filter((t) => t.projectId === projectId && t.statusId === statusId);
  const maxOrdem = daColuna.reduce((max, t) => Math.max(max, t.ordem), -1);

  const nova: Tarefa = {
    id: gerarId(),
    projectId,
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
  await dbSet("planejamento-tarefas", tarefas);

  return NextResponse.json(nova, { status: 201 });
}

// ── PATCH /api/planejamento/tarefas ──

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...campos } = body;

  if (!id) {
    return NextResponse.json({ error: "ID da tarefa é obrigatório." }, { status: 400 });
  }

  const tarefas = await dbGet<Tarefa[]>("planejamento-tarefas", []);
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

  await dbSet("planejamento-tarefas", tarefas);
  return NextResponse.json(tarefas[idx]);
}

// ── DELETE /api/planejamento/tarefas ──

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID da tarefa é obrigatório." }, { status: 400 });
  }

  const tarefas = await dbGet<Tarefa[]>("planejamento-tarefas", []);
  // Remove a tarefa + subtarefas
  const removidas = tarefas.filter((t) => t.id === id || t.parentTaskId === id);
  const restantes = tarefas.filter((t) => t.id !== id && t.parentTaskId !== id);

  if (restantes.length === tarefas.length) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }

  await dbSet("planejamento-tarefas", restantes);

  // Limpa anexos vinculados (Supabase) da tarefa e de cada subtarefa removida — nunca deve bloquear
  // a exclusão acima, que já aconteceu; cada iteração é protegida para uma falha não impedir as demais.
  for (const t of removidas) {
    await limparAnexosVinculados("planejamento_anexos", "planejamento-anexos", { tarefa_id: t.id }).catch((err) =>
      console.error(`[DELETE /api/planejamento/tarefas] falha ao limpar anexos da tarefa ${t.id}:`, err)
    );
  }

  return NextResponse.json({ ok: true });
}
