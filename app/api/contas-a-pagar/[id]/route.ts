import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
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
  const { userId } = await auth();
  const user = await currentUser();

  // Extrai e remove campos de edição recorrente — não devem ser persistidos nos dados
  const _updateMode = body._updateMode;
  const _updateModeRef = body._updateModeRef;
  delete body._updateMode;
  delete body._updateModeRef;

  // Injeta metadados de alteração no body para persistir em todos os fluxos
  body.updatedAt = new Date().toISOString();
  body.updatedById = userId || undefined;
  body.updatedBy = user?.fullName || user?.firstName || undefined;

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
      cliente: conta.cliente || "",
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
    if (conta.isLote && conta.loteItens) {
      try {
        const { marcarLoteComoPago } = await import("@/lib/reembolsos");
        await marcarLoteComoPago(conta.loteItens, dataPagamento);
      } catch {
        // Silencioso
      }
    } else if (conta.reembolsoId) {
      try {
        const { marcarComoPago } = await import("@/lib/reembolsos");
        await marcarComoPago(conta.reembolsoId, dataPagamento);
      } catch {
        // Silencioso
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
      cliente: body.cliente || conta.cliente || "",
    };
    dadosFC.lancamentos.push(novoLancamento);
    await salvarFC(dadosFC);

    dadosCP.contas = dadosCP.contas.map((c: { id: string }) =>
      c.id === id ? { ...c, ...body, status: "pago", fluxoCaixaId: novoLancamento.id } : c
    );
    await salvarCP(dadosCP);

    // ── Sincroniza reembolsos do lote se aplicável ──
    if (conta.isLote && conta.loteItens) {
      try {
        const { marcarLoteComoPago } = await import("@/lib/reembolsos");
        await marcarLoteComoPago(conta.loteItens, dataPagamento);
      } catch { /* silencioso */ }
    } else if (conta.reembolsoId) {
      try {
        const { marcarComoPago } = await import("@/lib/reembolsos");
        await marcarComoPago(conta.reembolsoId, dataPagamento);
      } catch { /* silencioso */ }
    }

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

  // Atualização simples — sincroniza com fluxo de caixa se vinculado
  const contaAtual = dadosCP.contas.find((c: { id: string }) => c.id === id);
  if (contaAtual?.fluxoCaixaId) {
    const dadosFC = await lerFC();
    const idxLanc = dadosFC.lancamentos.findIndex((l: any) => l.id === contaAtual.fluxoCaixaId);
    if (idxLanc >= 0) {
      const merged = { ...dadosFC.lancamentos[idxLanc], ...body, comprovanteUrl: body.comprovanteUrl === undefined ? dadosFC.lancamentos[idxLanc].comprovanteUrl : body.comprovanteUrl };
      // Recalcula obs baseada no fornecedor + descricao atualizados
      const fornecedor = body.fornecedor || contaAtual.fornecedor;
      const descricao = body.descricao || contaAtual.descricao;
      merged.obs = `${fornecedor}${descricao ? " — " + descricao : ""}`;
      // Sincroniza valor como negativo (saída)
      if (body.valor !== undefined) {
        merged.valor = -Math.abs(Number(body.valor));
      }
      dadosFC.lancamentos[idxLanc] = merged;
      await salvarFC(dadosFC);

      // Puxa comprovante do fluxo de caixa para a conta
      if (dadosFC.lancamentos[idxLanc].comprovanteUrl) {
        body.fluxoComprovanteUrl = dadosFC.lancamentos[idxLanc].comprovanteUrl;
      }
    }
  }

  dadosCP.contas = dadosCP.contas.map((c: any) =>
    c.id === id ? { ...c, ...body, fluxoComprovanteUrl: body.fluxoComprovanteUrl === undefined ? c.fluxoComprovanteUrl : body.fluxoComprovanteUrl } : c
  );
  await salvarCP(dadosCP);

  // ── Propagação de edição em contas recorrentes ──
  const contasAtualizadas: any[] = [];
  if (_updateMode && _updateMode !== "this" && _updateModeRef) {
    const dataRef = conta.dataVencimento;
    dadosCP.contas = dadosCP.contas.map((c: any) => {
      // Encontra irmãs: mesma origem (pela _parcelaDe) ou a conta "mãe" que gerou as parcelas
      const isSibling = c._parcelaDe === _updateModeRef;
      const isParent = c.recorrente && c.id === _updateModeRef;
      if (!isSibling && !isParent) return c;
      if (_updateMode === "thisAndFuture" && c.dataVencimento < dataRef) return c;
      const updated = { ...c, ...body, updatedAt: new Date().toISOString() };
      contasAtualizadas.push({ id: updated.id, ...body });
      return updated;
    });
  }

  // ── Se for lote de reembolsos, propaga alterações para a origem ──
  if (conta.isLote && body.loteItens && Array.isArray(body.loteItens)) {
    try {
      const { atualizarReembolso } = await import("@/lib/reembolsos");
      const { atualizarReembolsoDespesa } = await import("@/lib/reembolsos-despesas");

      for (const item of body.loteItens) {
        if (item.tipo === "logistica" && item.reembolsoId) {
          await atualizarReembolso(item.reembolsoId, {
            observacao: item.descricao,
            total: Number(item.valor) || 0,
            dataVencimento: body.dataVencimento || conta.dataVencimento,
          });
        } else if (item.tipo === "despesa" && item.reembolsoId) {
          await atualizarReembolsoDespesa(item.reembolsoId, {
            descricao: item.descricao,
            valor: Number(item.valor) || 0,
            dataVencimento: body.dataVencimento || conta.dataVencimento,
          });
        }
      }
    } catch (e) {
      console.error("Erro ao propagar lote para reembolsos:", e);
    }
  }

  return NextResponse.json({ ok: true, contasAtualizadas: contasAtualizadas.length > 0 ? contasAtualizadas : undefined });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = await lerCP();
  dados.contas = dados.contas.filter((c: { id: string }) => c.id !== id);
  await salvarCP(dados);
  return NextResponse.json({ ok: true });
}
