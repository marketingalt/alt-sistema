import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";

export const dynamic = "force-dynamic";

export interface ComissaoNF {
  id: string;
  vendedorId: string;
  ano: number;
  mes: number; // 0-11 (JAN=0)
  nfEmitida: boolean;
  dataEmissao?: string; // YYYY-MM-DD
  observacao?: string;
  createdAt: string;
  updatedAt: string;
}

function gerarId() {
  return "comnf" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function agora() {
  return new Date().toISOString();
}

const DB_KEY = "financeiro-comissoes-nf";

export async function GET() {
  const lista = await dbGet<ComissaoNF[]>(DB_KEY, []);
  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { vendedorId, ano, mes, nfEmitida, dataEmissao, observacao } = body;

  if (!vendedorId || ano === undefined || mes === undefined) {
    return NextResponse.json({ error: "vendedorId, ano e mes são obrigatórios." }, { status: 400 });
  }

  const lista = await dbGet<ComissaoNF[]>(DB_KEY, []);

  // Upsert: se já existe registro pra (vendedorId, ano, mes), atualiza
  const existente = lista.findIndex((r) => r.vendedorId === vendedorId && r.ano === ano && r.mes === mes);
  if (existente !== -1) {
    lista[existente] = {
      ...lista[existente],
      nfEmitida: nfEmitida ?? lista[existente].nfEmitida,
      dataEmissao: dataEmissao ?? lista[existente].dataEmissao,
      observacao: observacao ?? lista[existente].observacao,
      updatedAt: agora(),
    };
    await dbSet(DB_KEY, lista);
    return NextResponse.json(lista[existente]);
  }

  const novo: ComissaoNF = {
    id: gerarId(),
    vendedorId,
    ano: parseInt(ano),
    mes: parseInt(mes),
    nfEmitida: !!nfEmitida,
    dataEmissao: dataEmissao || "",
    observacao: observacao || "",
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

  const lista = await dbGet<ComissaoNF[]>(DB_KEY, []);
  const idx = lista.findIndex((r) => r.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
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

  const lista = await dbGet<ComissaoNF[]>(DB_KEY, []);
  const restantes = lista.filter((r) => r.id !== id);
  if (restantes.length === lista.length) {
    return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  }

  await dbSet(DB_KEY, restantes);
  return NextResponse.json({ ok: true });
}
