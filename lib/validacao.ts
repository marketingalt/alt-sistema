import type { ItemOrcamento, Produto } from "@/app/types";
import { estoqueVivo } from "@/lib/estoque";

export interface ErroValidacao {
  campo: string;
  label: string;
  mensagem: string;
}

export interface OrcamentoInput {
  cliente?: string;
  solicitante?: string;
  responsavel?: string;
  dataOrcamento?: string;
  dataSolicitacao?: string;
  itens?: Array<{
    item?: string;
    quantidade?: number;
    produtoId?: string;
    estoqueDisponivel?: number;
    origemXbz?: boolean;
  }>;
}

export function validarOrcamento(orcamento: OrcamentoInput): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  // Cliente
  if (!orcamento.cliente || orcamento.cliente.trim() === "") {
    erros.push({
      campo: "cliente",
      label: "Cliente",
      mensagem: "Selecione ou digite o nome do cliente.",
    });
  }

  // Solicitante
  if (!orcamento.solicitante || orcamento.solicitante.trim() === "") {
    erros.push({
      campo: "solicitante",
      label: "Solicitante",
      mensagem: "Informe o nome do solicitante.",
    });
  }

  // Responsável (opcional — preenchido automaticamente pelo perfil do usuário)
  // if (!orcamento.responsavel || orcamento.responsavel.trim() === "") {
  //   erros.push(...);
  // }

  // Data do orçamento (opcional — preenchida automaticamente)
  // if (!orcamento.dataOrcamento || orcamento.dataOrcamento.trim() === "") {
  //   erros.push(...);
  // }

  // Data da solicitação (opcional — preenchida automaticamente)
  // if (!orcamento.dataSolicitacao || orcamento.dataSolicitacao.trim() === "") {
  //   erros.push(...);
  // }

  // Itens
  if (!orcamento.itens || orcamento.itens.length === 0) {
    erros.push({
      campo: "itens",
      label: "Itens",
      mensagem: "Adicione pelo menos um item ao orçamento.",
    });
  } else {
    // Pelo menos um item deve ter nome preenchido
    const temItemValido = orcamento.itens.some((i) => i.item && i.item.trim() !== "");
    if (!temItemValido) {
      erros.push({
        campo: "itens",
        label: "Itens",
        mensagem: "Preencha o nome de pelo menos um item (material ou operacional).",
      });
    }

    // Verifica quantidade apenas em itens que já têm nome (ignora placeholders)
    orcamento.itens.forEach((item, idx) => {
      if (item.item && item.item.trim() !== "") {
        if (!item.quantidade || item.quantidade <= 0) {
          erros.push({
            campo: `itens[${idx}].quantidade`,
            label: `Item #${idx + 1}`,
            mensagem: `"${item.item}" não tem quantidade. Informe a quantidade.`,
          });
        }
      }
    });
  }

  return erros;
}

/**
 * Valida itens de origem XBZ cuja quantidade ultrapassa o estoque disponível.
 * Usa o estoque mais atual (`produtos` pós-sync), com fallback para o snapshot
 * salvo no item. Usado para exibir avisos em tempo real e bloquear o
 * salvamento de forma "suave" (o usuário pode confirmar que está ciente e
 * salvar mesmo assim).
 */
export function validarEstoque(orcamento: OrcamentoInput, produtos: Produto[] = []): ErroValidacao[] {
  const erros: ErroValidacao[] = [];
  if (!orcamento.itens) return erros;

  orcamento.itens.forEach((item, idx) => {
    if (!item.origemXbz) return;
    const qtd = item.quantidade || 0;
    const estoque = estoqueVivo(item as ItemOrcamento, produtos);
    if (estoque !== undefined && qtd > estoque) {
      erros.push({
        campo: `itens[${idx}].quantidade`,
        label: `Item #${idx + 1}`,
        mensagem: `"${item.item}" excede o estoque (disponível: ${estoque} un.).`,
      });
    }
  });

  return erros;
}
