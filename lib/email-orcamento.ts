import type { Orcamento } from "@/app/types";
import { FORMA_LINK_CARTAO } from "@/lib/calculos";

const DEFAULT_FRETE = "CUSTO ADICIONAL";

/** Formata número como moeda pt-BR: R$ 1.234,56 */
export function fmtBRL(v: number): string {
  return `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

/** Total do orçamento para o cliente: subtotal + manuseio + frete + taxa do cartão */
export function totalOrcamento(orc: Orcamento): number {
  const subtotal = (orc.itens || []).reduce((s, it) => s + (it.total || 0), 0);
  const taxa = orc.formaPagamento === FORMA_LINK_CARTAO ? (orc.taxaCartao || 0) : 0;
  return subtotal + (orc.custoManuseio || 0) + (orc.freteValor || 0) + taxa;
}

/** Assunto padrão: ALT2026 | {número} | {projeto} + {cliente} */
export function gerarAssuntoEmail(orc: Orcamento): string {
  const projeto = orc.nomeProjeto?.trim() || "Sem projeto";
  const cliente = orc.cliente?.trim() || "Cliente";
  return `ALT2026 | ${orc.numero} | ${projeto} + ${cliente}`;
}

/** Detecção automática de "a combinar" a partir dos campos do orçamento */
export function detectarPendencias(orc: Orcamento): string[] {
  const pend: string[] = [];
  const ehCombinar = (v?: string) => !v || /combinar/i.test(v);

  if (ehCombinar(orc.prazoPagamento)) pend.push("Prazo de pagamento a combinar");
  if (!orc.formaPagamento) pend.push("Forma de pagamento a combinar");
  if (ehCombinar(orc.prazoEntrega)) pend.push("Prazo de entrega a combinar");

  for (const it of orc.itens || []) {
    if (!it.valorUnitario || !it.total) {
      pend.push(`Valor do item "${it.descricao?.trim() || it.item?.trim() || "sem descrição"}" a confirmar`);
    }
  }

  // Frete: se foi preenchido um frete fora do padrão mas sem valor definido
  const freteInfo = orc.frete && !orc.frete.startsWith(DEFAULT_FRETE) ? orc.frete : null;
  if (freteInfo && !(orc.freteValor || 0)) pend.push("Frete a combinar");

  return pend;
}

interface OpcoesCorpo {
  /** Pendências já filtradas (checkbox). Padrão: todas as detectadas. */
  pendencias?: string[];
  /** Pendências livres digitadas na tela de envio (uma por linha) */
  outrasPendencias?: string;
}

/** Corpo do e-mail pronto para envio ao cliente */
export function gerarCorpoEmail(orc: Orcamento, opts: OpcoesCorpo = {}): string {
  const linhas: string[] = [];
  const contato = orc.solicitante?.trim() || orc.cliente?.trim() || "Cliente";

  linhas.push(`Olá, ${contato},`);
  linhas.push("");
  const projeto = orc.nomeProjeto?.trim() ? ` para o projeto "${orc.nomeProjeto.trim()}"` : "";
  linhas.push(`Segue o orçamento nº ${orc.numero}${projeto}.`);
  linhas.push("");

  // Resumo do pedido
  if (orc.itens?.length) {
    linhas.push("Resumo do pedido:");
    for (const it of orc.itens) {
      const desc = it.descricao?.trim() || it.item?.trim() || "Item";
      const qtd = it.quantidade ? `${it.quantidade}x` : "";
      const cor = it.cor?.trim() ? ` (${it.cor.trim()})` : "";
      linhas.push(`• ${desc}${cor} — ${qtd}`);
    }
    linhas.push("");
  }

  linhas.push(`Valor total: ${fmtBRL(totalOrcamento(orc))}`);
  if (orc.prazoPagamento && !/combinar/i.test(orc.prazoPagamento)) {
    linhas.push(`Prazo de pagamento: ${orc.prazoPagamento}`);
  }
  if (orc.prazoEntrega && !/combinar/i.test(orc.prazoEntrega)) {
    linhas.push(`Prazo de entrega: ${orc.prazoEntrega}`);
  }
  linhas.push("");

  // Pendências a combinar
  const pendencias = opts.pendencias ?? detectarPendencias(orc);
  const livres = (opts.outrasPendencias || "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (pendencias.length || livres.length) {
    linhas.push("Pendências a combinar:");
    for (const p of pendencias) linhas.push(`• ${p}`);
    for (const p of livres) linhas.push(`• ${p}`);
    linhas.push("");
  }

  if (orc.observacoes?.trim()) {
    linhas.push(orc.observacoes.trim());
    linhas.push("");
  }

  linhas.push("Atenciosamente,");
  linhas.push("ALT. MARKETING E PUBLICIDADE");
  return linhas.join("\n");
}
