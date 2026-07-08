import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";

export const dynamic = "force-dynamic";

export interface Venda {
  id: string;
  vendedorId: string;
  data: string; // YYYY-MM-DD
  cliente: string;
  cnpj?: string;
  notaFiscal?: "EMITIDA" | "A EMITIR" | "CANCELADA";
  dataEmissao?: string;
  produtoServico: string;
  valor: number;
  percentualComissao: number; // % aplicada nesta venda
  comissaoCalculada: number; // valor * percentual / 100
  status: "Realizada" | "Cancelada";
  observacao?: string;
  orcamentoId?: string;
  comissaoPaga?: boolean;
  createdAt: string;
  updatedAt: string;
}

function gerarId() {
  return "venda" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function agora() {
  return new Date().toISOString();
}

const DB_KEY = "financeiro-vendas";

export async function GET() {
  const lista = await dbGet<Venda[]>(DB_KEY, []);
  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { vendedorId, data, cliente, cnpj, notaFiscal, dataEmissao, produtoServico, valor, percentualComissao, status, observacao, orcamentoId } = body;

  if (!vendedorId || !cliente?.trim() || !data || !valor) {
    return NextResponse.json({ error: "vendedorId, cliente, data e valor são obrigatórios." }, { status: 400 });
  }

  const valorNum = parseFloat(valor) || 0;
  const pct = parseFloat(percentualComissao) || 0;

  const lista = await dbGet<Venda[]>(DB_KEY, []);
  const nova: Venda = {
    id: gerarId(),
    vendedorId,
    data,
    cliente: cliente.trim(),
    cnpj: cnpj || "",
    notaFiscal: notaFiscal || "A EMITIR",
    dataEmissao: dataEmissao || "",
    produtoServico: produtoServico || cliente.trim(),
    valor: valorNum,
    percentualComissao: pct,
    comissaoCalculada: valorNum * (pct / 100),
    status: status === "Cancelada" ? "Cancelada" : "Realizada",
    observacao: observacao || "",
    orcamentoId: orcamentoId || undefined,
    createdAt: agora(),
    updatedAt: agora(),
  };

  lista.push(nova);
  await dbSet(DB_KEY, lista);
  return NextResponse.json(nova, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...campos } = body;

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório." }, { status: 400 });
  }

  const lista = await dbGet<Venda[]>(DB_KEY, []);
  const idx = lista.findIndex((v) => v.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 });
  }

  const atualizada = { ...lista[idx], ...campos, id, updatedAt: agora() };

  // Recalcula comissão se valor ou % mudou
  if (campos.valor !== undefined || campos.percentualComissao !== undefined) {
    const v = campos.valor !== undefined ? parseFloat(campos.valor) || 0 : lista[idx].valor;
    const p = campos.percentualComissao !== undefined ? parseFloat(campos.percentualComissao) || 0 : lista[idx].percentualComissao;
    atualizada.valor = v;
    atualizada.percentualComissao = p;
    atualizada.comissaoCalculada = v * (p / 100);
  }

  lista[idx] = atualizada;
  await dbSet(DB_KEY, lista);
  return NextResponse.json(lista[idx]);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório." }, { status: 400 });
  }

  const lista = await dbGet<Venda[]>(DB_KEY, []);
  const restantes = lista.filter((v) => v.id !== id);
  if (restantes.length === lista.length) {
    return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 });
  }

  await dbSet(DB_KEY, restantes);
  return NextResponse.json({ ok: true });
}
