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
  itens?: Array<{ item?: string; quantidade?: number }>;
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
    orcamento.itens.forEach((item, idx) => {
      if (!item.item || item.item.trim() === "") {
        erros.push({
          campo: `itens[${idx}].item`,
          label: `Item #${idx + 1}`,
          mensagem: `O item #${idx + 1} não tem nome. Preencha o nome do material ou operacional.`,
        });
      }
      if (!item.quantidade || item.quantidade <= 0) {
        erros.push({
          campo: `itens[${idx}].quantidade`,
          label: `Item #${idx + 1}`,
          mensagem: `O item #${idx + 1} ("${item.item || "sem nome"}") não tem quantidade. Informe a quantidade.`,
        });
      }
    });
  }

  return erros;
}
