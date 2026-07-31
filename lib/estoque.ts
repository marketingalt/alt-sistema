import type { ItemOrcamento, Produto } from "@/app/types";

/**
 * Estoque XBZ — funções puras de validação de estoque e sugestão de similares.
 * O estoque de cada item é guardado em `item.estoqueDisponivel` (snapshot ao
 * selecionar o produto). `estoqueVivo` prefere o valor atual do produto na
 * lista (pós-sync da API) e só cai para o snapshot quando o produto não existe
 * mais na listagem.
 */

/** Quantidade atual do item (soma das variantes quando houver). */
function quantidadeAtual(item: ItemOrcamento): number {
  return item.quantidade || 0;
}

/** Estoque mais atual para o item: produto vivo na listagem > snapshot no item. */
export function estoqueVivo(item: ItemOrcamento, produtos: Produto[]): number | undefined {
  if (item.produtoId) {
    const vivo = produtos.find((p) => p.id === item.produtoId);
    if (vivo && vivo.estoque !== undefined) return vivo.estoque;
  }
  return item.estoqueDisponivel;
}

/** true quando o item é de origem XBZ e a quantidade pedida supera o estoque. */
export function excedeEstoque(item: ItemOrcamento, produtos: Produto[]): boolean {
  const estoque = estoqueVivo(item, produtos);
  if (estoque === undefined) return false;
  return quantidadeAtual(item) > estoque;
}

/** Normaliza texto em tokens: minúsculas, sem acentos, só [a-z0-9]. */
export function normalizarTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Busca produtos XBZ com descrição semelhante ao item e estoque suficiente
 * para a quantidade pedida. Pontua pela proporção de tokens em comum
 * (normalizados), desempata por maior estoque e retorna no máximo `max`.
 */
export function sugerirSimilares(item: ItemOrcamento, produtos: Produto[], max = 3): Produto[] {
  if (!item.item) return [];
  const qtd = quantidadeAtual(item);
  if (qtd <= 0) return [];

  const tokensBase = new Set(normalizarTokens(item.item));
  if (tokensBase.size === 0) return [];

  const candidatos = produtos.filter(
    (p) => p.origemXbz && p.id !== item.produtoId && (p.estoque ?? 0) >= qtd
  );

  return candidatos
    .map((p) => {
      const tokensAlvo = normalizarTokens(p.nome);
      if (tokensAlvo.length === 0) return { p, score: 0 };
      const comuns = tokensAlvo.filter((t) => tokensBase.has(t)).length;
      return { p, score: comuns / Math.max(tokensBase.size, tokensAlvo.length, 1) };
    })
    .filter((x) => x.score >= 0.4)
    .sort((a, b) => b.score - a.score || (b.p.estoque ?? 0) - (a.p.estoque ?? 0))
    .slice(0, max)
    .map((x) => x.p);
}
