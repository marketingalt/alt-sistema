import type { ItemOrcamento } from "@/app/types";

export function calcularCustoTotal(item: ItemOrcamento): number {
  const qty = item.quantidade || 1;
  const custoBase = (item.custoUnitario || 0) + (item.freteProducao || 0) / qty + (item.custoArte || 0) / qty;
  return custoBase;
}

// Preço de venda calculado pela margem: preco = custo / (1 - margem/100)
export function calcularValorSugerido(item: ItemOrcamento): number {
  const custo = calcularCustoTotal(item);
  const margem = item.margem || 0;
  if (margem >= 100 || custo === 0) return 0;
  return custo / (1 - margem / 100);
}

// Margem real dado o custo e o preço final informado
export function calcularMargemReal(custo: number, precoFinal: number): number {
  if (!precoFinal || !custo) return 0;
  return ((precoFinal - custo) / precoFinal) * 100;
}

export function recalcularItem(item: ItemOrcamento): ItemOrcamento {
  const valorFinal = item.valorAjustado ? item.valorUnitario : calcularValorSugerido(item);
  return {
    ...item,
    valorUnitario: valorFinal,
    total: valorFinal * (item.quantidade || 0),
  };
}
