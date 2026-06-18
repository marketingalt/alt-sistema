import type { ItemOrcamento } from "@/app/types";

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

export function recalcularItem(item: ItemOrcamento, margemExtra = 0): ItemOrcamento {
  const valorFinal = item.valorAjustado ? item.valorUnitario : calcularValorSugerido(item, margemExtra);
  return {
    ...item,
    valorUnitario: valorFinal,
    total: valorFinal * (item.quantidade || 0),
  };
}
