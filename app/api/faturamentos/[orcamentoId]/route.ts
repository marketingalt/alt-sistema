import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import { buscarOrcamento } from "@/lib/storage";

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

function calcularValor(registro: any): number {
  // Prioridade: valorAprovadoManual > orçamento vinculado
  if (registro.valorAprovadoManual) {
    return Math.abs(registro.valorAprovadoManual);
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

  if (idx >= 0) {
    const antes = dados.registros[idx];
    const registro = { ...antes, ...body };

    // ── Marcar como pago → criar lançamento no fluxo de caixa ──
    if (body.pago === true && !antes.pago) {
      const valor = calcularValor(registro);
      if (valor > 0) {
        const dadosFC = await lerFC();
        const novoLancamento = {
          id: `fc${Date.now()}`,
          data: body.dataPagamento || registro.vencimento || updatedAt,
          modalidade: "",
          banco: "",
          valor,
          area: "PROJETOS",
          categoria: "RECEITA OPERACIONAL BRUTA",
          obs: `${registro.cliente || ""}${registro.job ? " — " + registro.job : ""}`,
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
    if (body.pago === false && antes.fluxoCaixaId) {
      const dadosFC = await lerFC();
      dadosFC.lancamentos = dadosFC.lancamentos.filter(
        (l: any) => l.id !== antes.fluxoCaixaId
      );
      await salvarFC(dadosFC);
      registro.fluxoCaixaId = undefined;
    }

    dados.registros[idx] = { ...antes, ...registro, updatedAt };
  } else {
    dados.registros.push({ orcamentoId, ...body, updatedAt });
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
