import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";

export const dynamic = "force-dynamic";

export interface FiltrosRelatorio {
  vendedorIds: string[]; // vazio = todos
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  status: "todas" | "Realizada" | "Cancelada";
  nfStatus: "todas" | "Emitida" | "Pendente";
  comissaoPaga: "todas" | "sim" | "nao";
}

export interface RelatorioPreset {
  id: string;
  nome: string;
  filtros: FiltrosRelatorio;
  createdAt: string;
  updatedAt: string;
}

function gerarId() {
  return "preset" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function agora() {
  return new Date().toISOString();
}

const DB_KEY = "financeiro-relatorio-presets";

export async function GET() {
  const lista = await dbGet<RelatorioPreset[]>(DB_KEY, []);
  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nome, filtros } = body;

  if (!nome?.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }

  const lista = await dbGet<RelatorioPreset[]>(DB_KEY, []);
  const novo: RelatorioPreset = {
    id: gerarId(),
    nome: nome.trim(),
    filtros: {
      vendedorIds: filtros?.vendedorIds || [],
      dataInicio: filtros?.dataInicio || "",
      dataFim: filtros?.dataFim || "",
      status: filtros?.status || "todas",
      nfStatus: filtros?.nfStatus || "todas",
      comissaoPaga: filtros?.comissaoPaga || "todas",
    },
    createdAt: agora(),
    updatedAt: agora(),
  };

  lista.push(novo);
  await dbSet(DB_KEY, lista);
  return NextResponse.json(novo, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, nome, filtros } = body;

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório." }, { status: 400 });
  }

  const lista = await dbGet<RelatorioPreset[]>(DB_KEY, []);
  const idx = lista.findIndex((p) => p.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Preset não encontrado." }, { status: 404 });
  }

  if (nome) lista[idx].nome = nome.trim();
  if (filtros) {
    lista[idx].filtros = {
      vendedorIds: filtros.vendedorIds ?? lista[idx].filtros.vendedorIds,
      dataInicio: filtros.dataInicio ?? lista[idx].filtros.dataInicio,
      dataFim: filtros.dataFim ?? lista[idx].filtros.dataFim,
      status: filtros.status ?? lista[idx].filtros.status,
      nfStatus: filtros.nfStatus ?? lista[idx].filtros.nfStatus,
      comissaoPaga: filtros.comissaoPaga ?? lista[idx].filtros.comissaoPaga,
    };
  }
  lista[idx].updatedAt = agora();
  await dbSet(DB_KEY, lista);
  return NextResponse.json(lista[idx]);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório." }, { status: 400 });
  }

  const lista = await dbGet<RelatorioPreset[]>(DB_KEY, []);
  const restantes = lista.filter((p) => p.id !== id);
  if (restantes.length === lista.length) {
    return NextResponse.json({ error: "Preset não encontrado." }, { status: 404 });
  }

  await dbSet(DB_KEY, restantes);
  return NextResponse.json({ ok: true });
}
