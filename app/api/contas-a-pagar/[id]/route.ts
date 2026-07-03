import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";

interface ContasPagarDB {
  contas: any[];
}
interface FluxoCaixaDB {
  lancamentos: any[];
  saldoInicial?: number;
  saldoInicialData?: string;
}

async function lerCP(): Promise<ContasPagarDB> {
  return dbGet<ContasPagarDB>("contas-a-pagar", { contas: [] });
}
async function lerFC(): Promise<FluxoCaixaDB> {
  return dbGet<FluxoCaixaDB>("fluxo-caixa", { lancamentos: [] });
}
async function salvarCP(d: ContasPagarDB) {
  await dbSet("contas-a-pagar", d);
}
async function salvarFC(d: FluxoCaixaDB) {
  await dbSet("fluxo-caixa", d);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const dadosCP = await lerCP();

  const conta = dadosCP.contas.find((c: { id: string }) => c.id === id);
  if (!conta) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  // Fluxo "Marcar como Pago"
  if (body.pagar === true) {
    const { dataPagamento, modalidade, banco, dadosBancarios } = body;

    // Cria lançamento no fluxo de caixa
    const dadosFC = await lerFC();
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
      ordemServicoId: conta.ordemServicoId || "",
    };
    dadosFC.lancamentos.push(novoLancamento);
    await salvarFC(dadosFC);

    // Atualiza a conta
    dadosCP.contas = dadosCP.contas.map((c: { id: string }) =>
      c.id === id
        ? { ...c, status: "pago", dataPagamento, fluxoCaixaId: novoLancamento.id, ...(dadosBancarios ? { dadosBancarios } : {}) }
        : c
    );
    await salvarCP(dadosCP);

    // ── Se for reembolso, sincroniza status ──
    if (conta.reembolsoId) {
      try {
        const { marcarComoPago } = await import("@/lib/reembolsos");
        await marcarComoPago(conta.reembolsoId, dataPagamento);
      } catch {
        // Silencioso — não trava o pagamento por causa do sync
      }
    }

    return NextResponse.json({ ok: true, fluxoCaixaId: novoLancamento.id });
  }

  // Atualização simples (inclui mudança de status vindo do formulário de edição)
  // Se status mudou para "pago" e não tem fluxoCaixaId, cria fluxo de caixa
  if (body.status === "pago" && !conta.fluxoCaixaId) {
    const dataPagamento = body.dataPagamento || new Date().toISOString().split("T")[0];
    const dadosFC = await lerFC();
    const novoLancamento = {
      id: `fc${Date.now()}`,
      data: dataPagamento,
      modalidade: body.modalidade || conta.modalidade,
      banco: body.banco || conta.banco,
      valor: -Math.abs(body.valor ?? conta.valor),
      area: body.area || conta.area,
      categoria: body.categoria || conta.categoria,
      obs: `${body.fornecedor || conta.fornecedor}${body.descricao || conta.descricao ? " — " + (body.descricao || conta.descricao) : ""}`,
      createdAt: dataPagamento,
      ordemServicoId: body.ordemServicoId || conta.ordemServicoId || "",
    };
    dadosFC.lancamentos.push(novoLancamento);
    await salvarFC(dadosFC);

    dadosCP.contas = dadosCP.contas.map((c: { id: string }) =>
      c.id === id ? { ...c, ...body, status: "pago", fluxoCaixaId: novoLancamento.id } : c
    );
    await salvarCP(dadosCP);
    return NextResponse.json({ ok: true, fluxoCaixaId: novoLancamento.id });
  }

  // Se estava pago e mudou para pendente/cancelado, remove fluxo de caixa
  if (body.status && body.status !== "pago" && conta.fluxoCaixaId && conta.status === "pago") {
    const dadosFC = await lerFC();
    dadosFC.lancamentos = dadosFC.lancamentos.filter((l: any) => l.id !== conta.fluxoCaixaId);
    await salvarFC(dadosFC);

    dadosCP.contas = dadosCP.contas.map((c: { id: string }) =>
      c.id === id ? { ...c, ...body, fluxoCaixaId: undefined } : c
    );
    await salvarCP(dadosCP);
    return NextResponse.json({ ok: true });
  }

  // Atualização simples
  dadosCP.contas = dadosCP.contas.map((c: { id: string }) =>
    c.id === id ? { ...c, ...body } : c
  );
  await salvarCP(dadosCP);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = await lerCP();
  dados.contas = dados.contas.filter((c: { id: string }) => c.id !== id);
  await salvarCP(dados);
  return NextResponse.json({ ok: true });
}
