import type { ItemOrcamento, ItemVariante, Orcamento } from "@/app/types";

export function temSurchargeQtdMinima(item: ItemOrcamento): boolean {
  return !!(
    item.quantidadeMinima &&
    item.quantidadeMinima > 0 &&
    item.quantidade > 0 &&
    item.quantidade < item.quantidadeMinima
  );
}

export function calcularCustoTotal(item: ItemOrcamento): number {
  const qty = item.quantidade || 1;
  const fatorSurcharge = temSurchargeQtdMinima(item) ? 1.05 : 1;
  return Math.round((
    (item.custoUnitario || 0) * fatorSurcharge +
    (item.freteProducao || 0) / qty +
    (item.custoPersonalizacao || 0) / qty +
    (item.custoEmbalagemIndividual ?? 0) +
    (item.custoEmbalagemTransporte || 0) / qty
  ) * 100) / 100;
}

// margemExtra = honorários% + impostos% + comissão% definidos no orçamento
export function calcularValorSugerido(item: ItemOrcamento, margemExtra = 0): number {
  const custo = calcularCustoTotal(item);
  const margemTotal = (item.margem || 0) + margemExtra;
  if (margemTotal >= 100 || custo === 0) return 0;
  return Math.round((custo / (1 - margemTotal / 100)) * 100) / 100;
}

// Margem real dado o custo e o preço final informado
export function calcularMargemReal(custo: number, precoFinal: number): number {
  if (!precoFinal || !custo) return 0;
  return ((precoFinal - custo) / precoFinal) * 100;
}

/** Recalcula uma variante individual: total = quantidade * valorUnitario */
function recalcularVariante(v: ItemVariante): ItemVariante {
  const valorUnitario = Math.round(v.valorUnitario * 100) / 100;
  return {
    ...v,
    valorUnitario,
    total: Math.round(v.quantidade * valorUnitario * 100) / 100,
  };
}

/** Soma as quantidades das variantes */
function somarQuantidadeVariantes(variantes: ItemVariante[]): number {
  return variantes.reduce((s, v) => s + (v.quantidade || 0), 0);
}

/** Soma os totais das variantes */
function somarTotalVariantes(variantes: ItemVariante[]): number {
  return Math.round(variantes.reduce((s, v) => s + (v.total || 0), 0) * 100) / 100;
}

/** Média ponderada do custo unitário entre as variantes */
function mediaPonderadaCusto(variantes: ItemVariante[]): number {
  const qtdTotal = somarQuantidadeVariantes(variantes);
  if (qtdTotal === 0) return 0;
  return Math.round(variantes.reduce((s, v) => s + (v.custoUnitario || 0) * (v.quantidade || 0), 0) / qtdTotal * 100) / 100;
}

// ── Forma de pagamento / taxa de cartão ─────────────────────────

export const FORMA_LINK_CARTAO = "Link de cartão de crédito";

/** true quando a modalidade é de cartão (crédito ou débito) */
export function ehCartao(modalidade?: string): boolean {
  const m = (modalidade || "").toUpperCase().trim();
  return m === "CRÉDITO" || m === "DÉBITO";
}

/** Converte a forma de pagamento do orçamento para a modalidade usada no fluxo de caixa */
export function modalidadeDeFormaPagamento(forma?: string): string | undefined {
  if (!forma) return undefined;
  if (forma === FORMA_LINK_CARTAO) return "CRÉDITO";
  return forma;
}

/** Porcentagem que a taxa representa sobre o total base (para exibição) */
export function calcularPercTaxaCartao(base: number, taxa: number): number {
  if (!base || !taxa) return 0;
  return (taxa / base) * 100;
}

/** Data de vencimento = dataBase + dias. Retorna "DD/MM/AAAA" ou null se inválido. */
export function calcularDataVencimento(dataBase?: string, dias?: number): string | null {
  if (!dataBase || !dias) return null;
  const d = new Date(dataBase + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString("pt-BR");
}

/** Comissão de um orçamento: valor = subtotal + frete + manuseio (sem taxa cartão);
 *  por item usa percentualComissao do item ou o padrão do vendedor. */
export function calcularComissaoOrcamento(orc: Orcamento, pctPadraoVendedor: number) {
  const subtotal = (orc.itens || []).reduce((s, it) => s + (it.total || 0), 0);
  const valor = subtotal + (orc.freteValor || 0) + (orc.custoManuseio || 0);

  const itensComissao = (orc.itens || [])
    .filter((it) => (it.total || 0) > 0)
    .map((it, idx) => {
      const pct = it.percentualComissao ?? pctPadraoVendedor;
      return {
        item: it.item || `Item #${idx + 1}`,
        valor: it.total || 0,
        percentual: pct,
        comissao: (it.total || 0) * (pct / 100),
      };
    });
  const comissaoTotal = itensComissao.reduce((s, ci) => s + ci.comissao, 0);
  const pctMedia = valor > 0 ? (comissaoTotal / valor) * 100 : 0;

  return { valor, itensComissao, comissaoTotal, pctMedia };
}

// ── Frete ─────────────────────────────────────────

/** Extrai o valor da descrição de frete (formato "R$ 123,10 (14 km)") */
export function extrairValorFreteDescricao(descricao: string): number {
  const m = descricao.match(/R\$\s*([\d.,]+)/);
  if (!m) return 0;
  const num = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  return isNaN(num) ? 0 : num;
}

type CamposFrete = Pick<Orcamento, "frete" | "freteValor">;

/** Valor do frete a cobrar: freteValor se preenchido; senão, extrai da descrição */
export function valorFrete(orc: CamposFrete): number {
  const v = orc.freteValor && orc.freteValor > 0 ? orc.freteValor : 0;
  if (v > 0) return v;
  const frete = (orc.frete || "").trim();
  if (!frete) return 0;
  return extrairValorFreteDescricao(frete);
}

/** Info do frete para o documento: valor a cobrar + descrição exibida ao cliente */
export function infoFrete(orc: CamposFrete): { valor: number; descricao: string | null } {
  const frete = (orc.frete || "").trim();
  return { valor: valorFrete(orc), descricao: frete || null };
}

export function recalcularItem(item: ItemOrcamento, margemExtra = 0): ItemOrcamento {
  // Se tem variantes, recalcula cada uma e depois soma
  if (item.variantes && item.variantes.length > 0) {
    const variantes = item.variantes.map((v) => recalcularVariante(v));
    const qtdTotal = somarQuantidadeVariantes(variantes);
    const total = somarTotalVariantes(variantes);
    const custoMedio = mediaPonderadaCusto(variantes);
    const valorMedio = qtdTotal > 0 ? Math.round((total / qtdTotal) * 100) / 100 : 0;
    return {
      ...item,
      variantes,
      quantidade: qtdTotal,
      custoUnitario: custoMedio,
      valorUnitario: valorMedio,
      total,
    };
  }

  // Sem variantes — comportamento original
  const valorFinal = item.valorAjustado ? item.valorUnitario : calcularValorSugerido(item, margemExtra);
  const valorUnitario = Math.round(valorFinal * 100) / 100;
  return {
    ...item,
    valorUnitario,
    total: Math.round(valorUnitario * (item.quantidade || 0) * 100) / 100,
  };
}
