import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import { limparAnexosVinculados } from "@/lib/supabaseStorage";
import type { Projeto, Tarefa } from "@/app/types";

export const dynamic = "force-dynamic";

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

// ── Migração de dados antigos (colunas → statuses) ──

function migrarProjetos(projetos: any[]): Projeto[] {
  return projetos.map((p: any) => {
    // Já está no formato novo?
    if (Array.isArray(p.statuses)) return p as Projeto;

    // Formato antigo: tem colunas com cartões aninhados
    if (Array.isArray(p.colunas)) {
      const statuses = p.colunas.map((c: any, i: number) => ({
        id: c.id || gerarId(),
        nome: c.nome,
        cor: i === 0 ? "#6b7280" : i === 1 ? "#3b82f6" : i === 2 ? "#a855f7" : "#22c55e",
        ordem: i,
      }));
      return {
        id: p.id,
        nome: p.nome,
        descricao: p.descricao || "",
        cor: p.cor || "#6366f1",
        statuses,
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Projeto;
    }

    // Fallback: projeto inválido, retorna com statuses padrão
    return {
      id: p.id || gerarId(),
      nome: p.nome || "Projeto",
      descricao: p.descricao || "",
      cor: p.cor || "#6366f1",
      statuses: [
        { id: gerarId(), nome: "A FAZER", cor: "#6b7280", ordem: 0 },
        { id: gerarId(), nome: "FAZENDO", cor: "#3b82f6", ordem: 1 },
        { id: gerarId(), nome: "REVISÃO", cor: "#a855f7", ordem: 2 },
        { id: gerarId(), nome: "CONCLUÍDO", cor: "#22c55e", ordem: 3 },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Projeto;
  });
}

// ── GET /api/planejamento ──

export async function GET() {
  const rawProjetos = await dbGet<any[]>("planejamento", []);
  const projetos = migrarProjetos(rawProjetos);
  const tarefas = await dbGet<Tarefa[]>("planejamento-tarefas", []);

  // Salva de volta se houve migração
  if (rawProjetos.length > 0 && rawProjetos.some((p: any) => !Array.isArray(p.statuses))) {
    await dbSet("planejamento", projetos);
  }

  return NextResponse.json({ projetos, tarefas });
}

// ── POST /api/planejamento ──

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const user = await currentUser();
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
    userId: userId || undefined,
    userName: user?.fullName || user?.firstName || undefined,
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
  const tarefasDoProjeto = tarefas.filter((t) => t.projectId === id);
  const tarefasRestantes = tarefas.filter((t) => t.projectId !== id);
  await dbSet("planejamento-tarefas", tarefasRestantes);

  // Limpa anexos vinculados (Supabase) de todas as tarefas do projeto excluído — nunca deve bloquear
  // a exclusão acima, que já aconteceu; cada iteração é protegida para uma falha não impedir as demais.
  for (const t of tarefasDoProjeto) {
    await limparAnexosVinculados("planejamento_anexos", "planejamento-anexos", { tarefa_id: t.id }).catch((err) =>
      console.error(`[DELETE /api/planejamento] falha ao limpar anexos da tarefa ${t.id}:`, err)
    );
  }

  return NextResponse.json({ ok: true });
}
