import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";

export const dynamic = "force-dynamic";

export interface ComissaoItem {
  item: string;
  valor: number;
  percentual: number;
  comissao: number;
}

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
  percentualComissao: number; // % aplicada nesta venda (média ponderada)
  comissaoCalculada: number; // valor * percentual / 100, ou soma de comissaoItens
  comissaoItens?: ComissaoItem[]; // detalhamento por item do orçamento
  status: "Realizada" | "Cancelada";
  observacao?: string;
  orcamentoId?: string;
  comissaoPaga?: boolean;
  dataRecebimentoCliente?: string; // YYYY-MM-DD — quando o cliente pagou
  dataPagamentoComissao?: string; // YYYY-MM-DD — calculado pela regra
  createdAt: string;
  updatedAt: string;
}

function calcularDataPagamentoComissao(dataRecebimento: string): string {
  const d = new Date(dataRecebimento + "T12:00:00");
  const dia = d.getDate();
  const mes = d.getMonth() + 1; // 1-12
  const ano = d.getFullYear();

  if (dia >= 1 && dia <= 16) {
    // Paga dia 20 do mesmo mês
    return `${ano}-${String(mes).padStart(2, "0")}-20`;
  } else {
    // Paga dia 10 do mês seguinte
    const prox = new Date(ano, d.getMonth() + 1, 1);
    const pAno = prox.getFullYear();
    const pMes = prox.getMonth() + 1;
    return `${pAno}-${String(pMes).padStart(2, "0")}-10`;
  }
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
  const { vendedorId, data, cliente, cnpj, notaFiscal, dataEmissao, produtoServico, valor, percentualComissao, status, observacao, orcamentoId, dataRecebimentoCliente, comissaoItens } = body;

  if (!vendedorId || !cliente?.trim() || !data || !valor) {
    return NextResponse.json({ error: "vendedorId, cliente, data e valor são obrigatórios." }, { status: 400 });
  }

  const valorNum = parseFloat(valor) || 0;
  const pct = parseFloat(percentualComissao) || 0;

  // Se há detalhamento por itens, usa a soma como comissão calculada
  let comissaoCalculada = valorNum * (pct / 100);
  let comissaoItensSalvos: ComissaoItem[] | undefined;
  if (comissaoItens && Array.isArray(comissaoItens) && comissaoItens.length > 0) {
    comissaoItensSalvos = comissaoItens;
    comissaoCalculada = comissaoItens.reduce((s: number, ci: ComissaoItem) => s + (ci.comissao || 0), 0);
  }

  // Auto-calc data de pagamento da comissão
  let dataPagamentoComissao = "";
  if (dataRecebimentoCliente) {
    dataPagamentoComissao = calcularDataPagamentoComissao(dataRecebimentoCliente);
  }

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
    comissaoCalculada,
    comissaoItens: comissaoItensSalvos,
    status: status === "Cancelada" ? "Cancelada" : "Realizada",
    observacao: observacao || "",
    orcamentoId: orcamentoId || undefined,
    dataRecebimentoCliente: dataRecebimentoCliente || undefined,
    dataPagamentoComissao: dataPagamentoComissao || undefined,
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

  // Se comissaoItens foi enviado, calcula comissão a partir dos itens
  if (campos.comissaoItens && Array.isArray(campos.comissaoItens) && campos.comissaoItens.length > 0) {
    atualizada.comissaoItens = campos.comissaoItens;
    atualizada.comissaoCalculada = campos.comissaoItens.reduce((s: number, ci: ComissaoItem) => s + (ci.comissao || 0), 0);
  }

  // Recalcula comissão se valor ou % mudou (e não veio comissaoItens)
  if ((campos.valor !== undefined || campos.percentualComissao !== undefined) && !campos.comissaoItens) {
    const v = campos.valor !== undefined ? parseFloat(campos.valor) || 0 : lista[idx].valor;
    const p = campos.percentualComissao !== undefined ? parseFloat(campos.percentualComissao) || 0 : lista[idx].percentualComissao;
    atualizada.valor = v;
    atualizada.percentualComissao = p;
    atualizada.comissaoCalculada = v * (p / 100);
  }

  // Auto-calc data pagamento comissão se dataRecebimentoCliente foi fornecida
  if (campos.dataRecebimentoCliente) {
    atualizada.dataPagamentoComissao = calcularDataPagamentoComissao(campos.dataRecebimentoCliente);
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
