import type { ItemOrcamento, ItemVariante } from "@/app/types";

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
  return (
    (item.custoUnitario || 0) * fatorSurcharge +
    (item.freteProducao || 0) / qty +
    (item.custoPersonalizacao || 0) / qty +
    (item.custoEmbalagemIndividual ?? 0) +
    (item.custoEmbalagemTransporte || 0) / qty
  );
}

// margemExtra = honorários% + impostos% + comissão% definidos no orçamento
export function calcularValorSugerido(item: ItemOrcamento, margemExtra = 0): number {
  const custo = calcularCustoTotal(item);
  const margemTotal = (item.margem || 0) + margemExtra;
  if (margemTotal >= 100 || custo === 0) return 0;
  return custo / (1 - margemTotal / 100);
}

// Margem real dado o custo e o preço final informado
export function calcularMargemReal(custo: number, precoFinal: number): number {
  if (!precoFinal || !custo) return 0;
  return ((precoFinal - custo) / precoFinal) * 100;
}

/** Recalcula uma variante individual: total = quantidade * valorUnitario */
function recalcularVariante(v: ItemVariante): ItemVariante {
  return {
    ...v,
    total: Math.round(v.quantidade * v.valorUnitario * 100) / 100,
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
  return {
    ...item,
    valorUnitario: valorFinal,
    total: valorFinal * (item.quantidade || 0),
  };
}
