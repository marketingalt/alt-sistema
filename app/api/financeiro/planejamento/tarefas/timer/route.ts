import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import type { Tarefa } from "@/app/types";

export const dynamic = "force-dynamic";

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

// ── POST /api/financeiro/planejamento/tarefas/timer ──

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tarefaId, action } = body;

  if (!tarefaId || !action) {
    return NextResponse.json({ error: "tarefaId e action são obrigatórios." }, { status: 400 });
  }

  if (!["start", "stop", "discard"].includes(action)) {
    return NextResponse.json({ error: 'action deve ser "start", "stop" ou "discard".' }, { status: 400 });
  }

  const tarefas = await dbGet<Tarefa[]>("financeiro-planejamento-tarefas", []);
  const idx = tarefas.findIndex((t) => t.id === tarefaId);

  if (idx === -1) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }

  const tarefa = tarefas[idx];
  const agora = new Date().toISOString();

  if (action === "start") {
    // Verifica se já há timer rodando nesta tarefa
    const ultimoLog = tarefa.timeTracking.logs[tarefa.timeTracking.logs.length - 1];
    if (ultimoLog && !ultimoLog.endTime) {
      return NextResponse.json({ error: "Já existe um timer ativo nesta tarefa." }, { status: 400 });
    }

    tarefa.timeTracking.logs.push({
      id: gerarId(),
      startTime: agora,
      durationSeconds: 0,
    });
  } else if (action === "stop") {
    const ultimoLog = tarefa.timeTracking.logs[tarefa.timeTracking.logs.length - 1];
    if (!ultimoLog || ultimoLog.endTime) {
      return NextResponse.json({ error: "Nenhum timer ativo para parar." }, { status: 400 });
    }

    const startMs = new Date(ultimoLog.startTime).getTime();
    const endMs = new Date(agora).getTime();
    const duracao = Math.floor((endMs - startMs) / 1000);

    ultimoLog.endTime = agora;
    ultimoLog.durationSeconds = duracao;
    tarefa.timeTracking.totalSeconds += duracao;
  } else if (action === "discard") {
    // Descarta o último log sem salvar
    tarefa.timeTracking.logs.pop();
  }

  tarefa.updatedAt = agora;
  tarefas[idx] = tarefa;
  await dbSet("financeiro-planejamento-tarefas", tarefas);

  return NextResponse.json(tarefa);
}
