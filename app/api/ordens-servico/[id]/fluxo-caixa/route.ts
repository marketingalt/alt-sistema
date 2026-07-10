import { NextRequest, NextResponse } from "next/server";
import { dbGet } from "@/lib/storage-adapter";

export const dynamic = "force-dynamic";

// ── Tipos de lançamento no agregador ──────────────────────
export interface ItemFluxoOS {
  id: string;
  tipo: "conta-pagar" | "reembolso" | "fluxo-caixa" | "faturamento";
  data: string;
  descricao: string;
  valor: number; // negativo = despesa, positivo = receita
  status: string;
  detalhes: Record<string, unknown>;
}

export interface ResumoFluxoOS {
  receitas: number;
  despesas: number;
  saldo: number;
  contasPagar: number;
  reembolsos: number;
  faturamentos: number;
  fluxoCaixa: number;
  itens: ItemFluxoOS[];
}

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itens: ItemFluxoOS[] = [];

    // ── 1. Contas a Pagar ──────────────────────────────
    try {
      const cpDb = await dbGet<{ contas: any[] }>("contas-a-pagar", { contas: [] });
      for (const c of cpDb.contas.filter((c) => c.ordemServicoId === id)) {
        itens.push({
          id: c.id,
          tipo: "conta-pagar",
          data: c.dataVencimento || c.createdAt,
          descricao: c.descricao || `${c.fornecedor} — ${c.categoria}`,
          valor: -(c.valor || 0),
          status: c.status || "pendente",
          detalhes: {
            fornecedor: c.fornecedor,
            categoria: c.categoria,
            area: c.area,
            modalidade: c.modalidade,
            banco: c.banco,
            dadosBancarios: c.dadosBancarios,
            dataPagamento: c.dataPagamento,
            obs: c.obs,
          },
        });
      }
    } catch { /* silencioso */ }

    // ── 2. Reembolsos (logística) ──────────────────────
    try {
      const reDb = await dbGet<{ reembolsos: any[] }>("reembolsos", { reembolsos: [] });
      for (const r of reDb.reembolsos.filter((r) => r.ordemServicoId === id)) {
        itens.push({
          id: r.id,
          tipo: "reembolso",
          data: r.dataFinal || r.createdAt,
          descricao: r.motivo
            ? `${r.motivo} — ${r.origem} → ${r.destino} (${r.distanciaKm} km)`
            : `${r.origem} → ${r.destino} (${r.distanciaKm} km)`,
          valor: -(r.total || 0),
          status: r.status || "pendente",
          detalhes: {
            motorista: r.motorista,
            origem: r.origem,
            destino: r.destino,
            distanciaKm: r.distanciaKm,
            valorKm: r.valorKm,
            total: r.total,
            motivo: r.motivo,
            observacao: r.observacao,
            odometroInicial: r.odometroInicial,
            odometroFinal: r.odometroFinal,
            dataInicial: r.dataInicial,
            dataFinal: r.dataFinal,
            dadosBancarios: r.dadosBancarios,
            loteId: r.loteId,
            comprovante: r.comprovante,
          },
        });
      }
    } catch { /* silencioso */ }

    // ── 3. Fluxo de Caixa (lançamentos avulsos) ────────
    try {
      const fcDb = await dbGet<{ lancamentos: any[] }>("fluxo-caixa", { lancamentos: [] });
      for (const l of fcDb.lancamentos.filter(
        (l) => l.ordemServicoId === id && !l.contaPagarId
      )) {
        itens.push({
          id: l.id,
          tipo: "fluxo-caixa",
          data: l.data || l.createdAt,
          descricao: l.obs || `Lançamento — ${l.categoria}`,
          valor: l.valor || 0,
          status: "realizado",
          detalhes: {
            modalidade: l.modalidade,
            banco: l.banco,
            area: l.area,
            categoria: l.categoria,
            obs: l.obs,
          },
        });
      }
    } catch { /* silencioso */ }

    // ── 4. Faturamentos (receitas) ─────────────────────
    try {
      const fatDb = await dbGet<{ registros: any[] }>("faturamentos", { registros: [] });
      for (const f of fatDb.registros.filter(
        (f) => f.ordemServicoId === id
      )) {
        // Buscar orçamento para nome do cliente
        const cliente =
          f.cliente ||
          (await (async () => {
            try {
              const orc = await dbGet<any[]>("orcamentos", []);
              const o = orc.find((o: any) => o.id === f.orcamentoId);
              return o?.cliente || "";
            } catch {
              return "";
            }
          })());
        itens.push({
          id: f.orcamentoId,
          tipo: "faturamento",
          data: f.vencimento || f.dataEmissao || "",
          descricao: `Faturamento${cliente ? ` — ${cliente}` : ""}`,
          valor: f.valorAprovadoManual || f.custo || 0,
          status: f.pago ? "pago" : f.statusNota || "Pendente",
          detalhes: {
            cliente,
            orcamentoId: f.orcamentoId,
            statusNota: f.statusNota,
            numeroNota: f.numeroNota,
            dataEmissao: f.dataEmissao,
            dataPagamento: f.dataPagamento,
            vencimento: f.vencimento,
            imposto: f.imposto,
            comissao: f.comissao,
            custoReais: f.custosReais,
          },
        });
      }
    } catch { /* silencioso */ }

    // Ordenar por data (mais recente primeiro)
    itens.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    // ── Resumo ─────────────────────────────────────────
    const resumo: ResumoFluxoOS = {
      receitas: itens.filter((i) => i.valor > 0).reduce((s, i) => s + i.valor, 0),
      despesas: itens.filter((i) => i.valor < 0).reduce((s, i) => s + Math.abs(i.valor), 0),
      saldo: 0,
      contasPagar: itens.filter((i) => i.tipo === "conta-pagar").reduce((s, i) => s + Math.abs(i.valor), 0),
      reembolsos: itens.filter((i) => i.tipo === "reembolso").reduce((s, i) => s + Math.abs(i.valor), 0),
      faturamentos: itens.filter((i) => i.tipo === "faturamento").reduce((s, i) => s + i.valor, 0),
      fluxoCaixa: itens.filter((i) => i.tipo === "fluxo-caixa").reduce((s, i) => s + i.valor, 0),
      itens,
    };
    resumo.saldo = resumo.receitas - resumo.despesas;

    return NextResponse.json(resumo, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    console.error("[FLUXO-CAIXA-OS ERROR]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
