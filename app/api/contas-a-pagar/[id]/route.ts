import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE_CP = path.join(process.cwd(), "data", "contas-a-pagar.json");
const FILE_FC = path.join(process.cwd(), "data", "fluxo-caixa.json");

function lerCP() { return JSON.parse(fs.readFileSync(FILE_CP, "utf-8")); }
function lerFC() { return JSON.parse(fs.readFileSync(FILE_FC, "utf-8")); }
function salvarCP(d: unknown) { fs.writeFileSync(FILE_CP, JSON.stringify(d, null, 2), "utf-8"); }
function salvarFC(d: unknown) { fs.writeFileSync(FILE_FC, JSON.stringify(d, null, 2), "utf-8"); }

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const dadosCP = lerCP();

  const conta = dadosCP.contas.find((c: { id: string }) => c.id === id);
  if (!conta) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  // Fluxo "Marcar como Pago"
  if (body.pagar === true) {
    const { dataPagamento, modalidade, banco, dadosBancarios } = body;

    // Cria lançamento no fluxo de caixa
    const dadosFC = lerFC();
    const novoLancamento = {
      id: `fc${Date.now()}`,
      data: dataPagamento,
      modalidade,
      banco,
      valor: -Math.abs(conta.valor),
      area: conta.area,
      categoria: conta.categoria,
      obs: `${conta.fornecedor}${conta.descricao ? " — " + conta.descricao : ""}`,
      createdAt: dataPagamento,
    };
    dadosFC.lancamentos.push(novoLancamento);
    salvarFC(dadosFC);

    // Atualiza a conta
    dadosCP.contas = dadosCP.contas.map((c: { id: string }) =>
      c.id === id
        ? { ...c, status: "pago", dataPagamento, fluxoCaixaId: novoLancamento.id, ...(dadosBancarios ? { dadosBancarios } : {}) }
        : c
    );
    salvarCP(dadosCP);

    return NextResponse.json({ ok: true, fluxoCaixaId: novoLancamento.id });
  }

  // Atualização simples
  dadosCP.contas = dadosCP.contas.map((c: { id: string }) =>
    c.id === id ? { ...c, ...body } : c
  );
  salvarCP(dadosCP);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = lerCP();
  dados.contas = dados.contas.filter((c: { id: string }) => c.id !== id);
  salvarCP(dados);
  return NextResponse.json({ ok: true });
}
