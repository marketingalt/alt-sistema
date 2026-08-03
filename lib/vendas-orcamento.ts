import { dbGet, dbSet } from "@/lib/storage-adapter";
import type { Orcamento } from "@/app/types";
import { calcularComissaoOrcamento } from "@/lib/calculos";
import type { Venda } from "@/app/api/financeiro/vendas-comissoes/vendas/route";
import type { Vendedor } from "@/app/api/financeiro/vendas-comissoes/vendedores/route";

const VENDAS_KEY = "financeiro-vendas";
const VENDEDORES_KEY = "financeiro-vendedores";

function gerarId() {
  return "venda" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Mantém a venda/comissão do comercial em sincronia com o orçamento.
 * - Orçamento Aprovado com vendedor → cria a venda (ou reativa se cancelada).
 * - Orçamento Recusado/Cancelado → cancela a venda existente.
 * Sem duplicação (busca por orcamentoId).
 */
export async function sincronizarVendaComercial(
  orcamentoAnterior: Orcamento | null | undefined,
  salvo: Orcamento
) {
  const statusNovo = salvo.status;
  if (statusNovo !== "Aprovado" && statusNovo !== "Recusado" && statusNovo !== "Cancelado") {
    return;
  }

  const vendas = await dbGet<Venda[]>(VENDAS_KEY, []);
  const existente = vendas.find((v) => v.orcamentoId === salvo.id);

  // Aprovado → cria ou reativa a venda
  if (statusNovo === "Aprovado") {
    if (!salvo.vendedorId) return;

    if (!existente) {
      const vendedores = await dbGet<Vendedor[]>(VENDEDORES_KEY, []);
      const vendedor = vendedores.find((v) => v.id === salvo.vendedorId);
      const { valor, itensComissao, comissaoTotal, pctMedia } = calcularComissaoOrcamento(
        salvo,
        vendedor?.percentualComissao ?? 0
      );

      const agora = new Date().toISOString();
      const nova: Venda = {
        id: gerarId(),
        vendedorId: salvo.vendedorId,
        data: agora.split("T")[0], // hoje (dia da aprovação)
        cliente: salvo.cliente || "Cliente",
        notaFiscal: "A EMITIR",
        produtoServico: salvo.nomeProjeto || `Orçamento #${salvo.numero}`,
        valor,
        percentualComissao: pctMedia,
        comissaoCalculada: comissaoTotal,
        comissaoItens: itensComissao,
        status: "Realizada",
        orcamentoId: salvo.id,
        createdAt: agora,
        updatedAt: agora,
      };
      vendas.push(nova);
      await dbSet(VENDAS_KEY, vendas);
    } else if (existente.status === "Cancelada") {
      existente.status = "Realizada";
      existente.updatedAt = new Date().toISOString();
      await dbSet(VENDAS_KEY, vendas);
    }
    return;
  }

  // Recusado/Cancelado → cancela a venda
  if (existente && existente.status === "Realizada") {
    existente.status = "Cancelada";
    existente.updatedAt = new Date().toISOString();
    await dbSet(VENDAS_KEY, vendas);
  }
}
