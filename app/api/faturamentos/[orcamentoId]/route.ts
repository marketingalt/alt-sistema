import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import { buscarOrcamento } from "@/lib/storage";
import { ehCartao, FORMA_LINK_CARTAO, modalidadeDeFormaPagamento } from "@/lib/calculos";

interface FaturamentosDB {
  registros: any[];
}

interface FluxoCaixaDB {
  lancamentos: any[];
  saldoInicial?: number;
  saldoInicialData?: string;
}

async function lerFat(): Promise<FaturamentosDB> {
  return dbGet<FaturamentosDB>("faturamentos", { registros: [] });
}
async function salvarFat(d: FaturamentosDB) {
  await dbSet("faturamentos", d);
}
async function lerFC(): Promise<FluxoCaixaDB> {
  return dbGet<FluxoCaixaDB>("fluxo-caixa", { lancamentos: [] });
}
async function salvarFC(d: FluxoCaixaDB) {
  await dbSet("fluxo-caixa", d);
}

async function calcularValor(registro: any): Promise<number> {
  if (registro.valorAprovadoManual) {
    return Math.abs(registro.valorAprovadoManual);
  }
  // Fallback: orçamento vinculado
  if (registro.orcamentoId) {
    const orc = await buscarOrcamento(registro.orcamentoId);
    if (orc?.itens) {
      const subtotal = orc.itens.reduce((s: number, it: any) => s + (it.total || 0), 0);
      const taxaOrc = orc.formaPagamento === FORMA_LINK_CARTAO ? (orc.taxaCartao || 0) : 0;
      const base = subtotal + (orc.freteValor || 0) + (orc.custoManuseio || 0) + taxaOrc;
      // Cartão de crédito: o banco recebe o líquido (bruto − taxa) — bate com o extrato
      return base - (ehCartao(registro.modalidade) ? taxaOrc : 0);
    }
  }
  return 0;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ orcamentoId: string }> }
) {
  const { orcamentoId } = await params;
  const body = await req.json();
  const { userId } = await auth();
  const user = await currentUser();
  const dados = await lerFat();
  const updatedAt = new Date().toISOString().split("T")[0];

  // Injeta metadados de alteração
  body.updatedById = userId || undefined;
  body.updatedBy = user?.fullName || user?.firstName || undefined;

  const idx = dados.registros.findIndex(
    (r: { id?: string; orcamentoId?: string }) =>
      r.id === orcamentoId || r.orcamentoId === orcamentoId
  );
  const antes = idx >= 0 ? dados.registros[idx] : undefined;
  const registro = idx >= 0 ? { ...antes, ...body } : { orcamentoId, ...body };

  // Novo registro vinculado a um orçamento: pré-preenche com dados do
  // orçamento para a linha em Contas a Receber não perder cliente/job/etc.
  if (idx < 0 && registro.orcamentoId) {
    const orc = await buscarOrcamento(registro.orcamentoId);
    if (orc) {
      const subtotal = (orc.itens || []).reduce((s: number, it: any) => s + (it.total || 0), 0);
      const valorAprovado = subtotal + (orc.freteValor || 0) + (orc.custoManuseio || 0);
      registro.cliente ??= orc.cliente;
      registro.job ??= orc.nomeProjeto || orc.numero;
      registro.responsavel ??= orc.responsavel || (orc as any).userName;
      registro.statusJob ??= orc.status;
      registro.dataEmissao ??= orc.dataOrcamento;
      registro.modalidade ??= modalidadeDeFormaPagamento(orc.formaPagamento);
      registro.imposto ??= orc.percImpostos ? valorAprovado * (orc.percImpostos / 100) : 0;
      registro.comissao ??= orc.percComissao ? valorAprovado * (orc.percComissao / 100) : 0;
      registro.vencimento ??= (() => {
        // Dias do cartão têm prioridade; senão tenta extrair do prazo de pagamento
        const dias = orc.diasPagamento ?? (orc.prazoPagamento ? parseInt(orc.prazoPagamento, 10) || 0 : 0);
        if (!dias || !orc.dataOrcamento) return undefined;
        const base = new Date(orc.dataOrcamento + "T12:00:00");
        if (isNaN(base.getTime())) return undefined;
        base.setDate(base.getDate() + dias);
        return base.toISOString().split("T")[0];
      })();
    }
  }

  // ── Marcar como pago → criar lançamento no fluxo de caixa ──
  if (body.pago === true && !antes?.pago) {
    const valor = await calcularValor(registro);
    if (valor > 0) {
      const dadosFC = await lerFC();
      let obsTaxa = "";
      if (ehCartao(registro.modalidade) && registro.orcamentoId) {
        const orc = await buscarOrcamento(registro.orcamentoId);
        if (orc?.formaPagamento === FORMA_LINK_CARTAO && (orc.taxaCartao || 0) > 0) {
          obsTaxa = ` — líquido (taxa cartão ${(orc.taxaCartao || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`;
        }
      }
      const novoLancamento = {
        id: `fc${Date.now()}`,
        data: body.dataPagamento || registro.vencimento || updatedAt,
        modalidade: registro.modalidade || "",
        banco: registro.banco || "",
        valor,
        area: "PROJETOS",
        categoria: "RECEITA OPERACIONAL BRUTA",
        obs: `${registro.cliente || ""}${registro.job ? " — " + registro.job : ""}${obsTaxa}`,
        createdAt: body.dataPagamento || updatedAt,
        ordemServicoId: registro.ordemServicoId || "",
        cliente: registro.cliente || "",
      };
      dadosFC.lancamentos.push(novoLancamento);
      await salvarFC(dadosFC);
      registro.fluxoCaixaId = novoLancamento.id;
    }
  }

  // ── Desmarcar como pago → remover lançamento do fluxo de caixa ──
  if (body.pago === false && antes?.fluxoCaixaId) {
    const dadosFC = await lerFC();
    dadosFC.lancamentos = dadosFC.lancamentos.filter(
      (l: any) => l.id !== antes.fluxoCaixaId
    );
    await salvarFC(dadosFC);
    registro.fluxoCaixaId = undefined;
  }

  // ── Já pago: sincroniza banco/forma no lançamento existente do fluxo de caixa ──
  if (antes?.fluxoCaixaId && body.pago !== false && (body.banco !== undefined || body.modalidade !== undefined)) {
    const dadosFC = await lerFC();
    const lanc = dadosFC.lancamentos.find((l: any) => l.id === antes.fluxoCaixaId);
    if (lanc) {
      if (body.banco !== undefined) lanc.banco = body.banco;
      if (body.modalidade !== undefined) lanc.modalidade = body.modalidade;
      await salvarFC(dadosFC);
    }
  }

  if (idx >= 0) {
    dados.registros[idx] = { ...antes, ...registro, updatedAt };
  } else {
    dados.registros.push({ ...registro, updatedAt });
  }

  await salvarFat(dados);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ orcamentoId: string }> }
) {
  const { orcamentoId } = await params;
  const dados = await lerFat();
  dados.registros = dados.registros.filter(
    (r: { id?: string; orcamentoId?: string }) =>
      r.id !== orcamentoId && r.orcamentoId !== orcamentoId
  );
  await salvarFat(dados);
  return NextResponse.json({ ok: true });
}
