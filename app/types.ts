// ── Clerk type augmentation ────────────────────────
export {};

declare global {
  namespace Clerk {
    interface UserPublicMetadata {
      role?: "admin" | "user";
    }
  }
}

// ── Tipos do sistema ─────────────────────────────

export type TipoPersonalizacao =
  | "Silk"
  | "DTF"
  | "Bordado"
  | "Laser"
  | "Verniz UV"
  | "Tampografia"
  | "Sublimação"
  | "Gravação em relevo"
  | "Outro";

export interface ItemVariante {
  id: string;
  descricao?: string;      // opcional — ex: "Azul 500un", "Branca 100un"
  quantidade: number;
  custoUnitario: number;
  valorUnitario: number;
  total: number;
}

export interface ItemOrcamento {
  id: string;
  kit: string;
  referencia: string;
  fornecedorId?: string;
  fornecedorNome?: string;
  item: string;
  cor?: string;
  ncm?: string;
  categoria?: "brindes" | "servico";
  acabamento: TipoPersonalizacao | string;
  descricao: string;
  quantidade: number;
  imagemReferencia?: string;   // base64 da imagem de referência do item
  // Precificação
  custoUnitario: number;       // custo do fornecedor por unidade
  quantidadeMinima?: number;   // qtd mínima do fornecedor; se quantidade < mínimo, +5% no custo
  diasProducao?: number;              // prazo de produção em dias úteis
  freteProducao: number;              // frete total de produção (dividido pela qtd)
  custoPersonalizacao: number;        // custo total de personalização no fornecedor (dividido pela qtd)
  custoEmbalagemIndividual?: number;  // custo por item de embalagem individual (não dividido)
  custoEmbalagemTransporte?: number;  // custo total de embalagem de transporte (dividido pela qtd)
  margem: number;              // margem em % (ex: 40 = 40%)
  percentualComissao?: number; // % de comissão deste item (fallback: % do vendedor)
  valorUnitario: number;       // preço final ao cliente
  valorAjustado: boolean;      // true = usuário sobrescreveu o valor calculado
  total: number;
  /** Variações de quantidade/custo do mesmo item.
   *  Quando presente, quantidade / total do item são a soma das variantes,
   *  e custoUnitario / valorUnitario são a média ponderada. */
  variantes?: ItemVariante[];
}

export type StatusOrcamento =
  | "Em andamento"
  | "Enviado"
  | "Aprovado"
  | "Recusado"
  | "Cancelado";

export const STATUS_CONFIG: Record<StatusOrcamento, { cor: string; bg: string; dot: string }> = {
  "Em andamento": { cor: "text-blue-700",  bg: "bg-blue-50 border-blue-200",   dot: "bg-blue-500" },
  "Enviado":      { cor: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-500" },
  "Aprovado":     { cor: "text-green-700",  bg: "bg-green-50 border-green-200",  dot: "bg-green-500" },
  "Recusado":     { cor: "text-red-700",    bg: "bg-red-50 border-red-200",      dot: "bg-red-500" },
  "Cancelado":    { cor: "text-gray-500",   bg: "bg-gray-50 border-gray-200",    dot: "bg-gray-400" },
};

export interface DocumentoFornecedor {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  caminho: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export type StatusCliente = "Ativo" | "Inativo" | "Inadimplente";
export type FormaPagamento = "Cartão Corporativo" | "Boleto" | "TED" | "PIX";

export interface Cliente {
  id: string;
  // Identificação e Faturamento
  nomeEmpresa: string;
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string;
  // Contato Direto
  nomeContato: string;
  emailContato: string;
  whatsappContato: string;
  // Contato Financeiro
  mesmoContatoFinanceiro: boolean;
  nomeContatoFinanceiro: string;
  emailContatoFinanceiro: string;
  whatsappContatoFinanceiro: string;
  // Localização e Entrega
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  // Financeiro
  formasPagamento: FormaPagamento[];
  prazoPagamento?: string;
  status: StatusCliente;
  // Documentos
  documentos?: DocumentoFornecedor[];
  // Solicitantes cadastrados neste cliente
  solicitantes?: string[];
  // Restrição de acesso
  restritoFinanceiro?: boolean;
  // Meta
  createdAt: string;
  userId?: string;
  userName?: string;
  updatedAt?: string;
  updatedById?: string;
  updatedBy?: string;
  participantes?: { userId: string; nome: string }[];
}

export interface Fornecedor {
  id: string;
  documentos?: DocumentoFornecedor[];
  // Identificação
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  // Contatos
  nomeContato: string;
  emailCorporativo: string;
  whatsapp: string;
  // Especificações
  categoria: string;
  produtos: string;
  pedidoMinimo: string;
  // Logística
  prazoEntregaDias: string;
  endereco: string;
  cidade: string;
  estado: string;
  // Financeiro
  condicoesPagamento: string;
  dadosBancarios: string;
  status: "Ativo" | "Inativo";
  // Restrição de acesso
  restritoFinanceiro?: boolean;
  // Meta
  createdAt: string;
  userId?: string;
  userName?: string;
  updatedAt?: string;
  updatedById?: string;
  updatedBy?: string;
  participantes?: { userId: string; nome: string }[];
}

export interface Produto {
  id: string;
  sku: string;
  nome: string;
  marca: string;
  precoCusto: number;
  precoFinal?: number;
  fornecedorId: string;
  fornecedorNome: string;
  imagemUrl?: string;
  informacaoTecnica?: string;
  jaPersonalizado: boolean;
  ncm?: string;
  cor?: string;
  estoque?: number;
  xbzId?: string;
  origemXbz?: boolean;
  status: "Ativo" | "Inativo";
  createdAt: string;
  userId?: string;
  userName?: string;
  updatedAt?: string;
  updatedById?: string;
  updatedBy?: string;
  participantes?: { userId: string; nome: string }[];
}

export interface VersaoOrcamento {
  id: string;
  nome: string;
  dados: Omit<Orcamento, 'versoes'>;
  criadaEm: string;
}

export interface HistoricoAlteracao {
  id: string;
  tipo: "criacao" | "status" | "edicao";
  descricao: string;
  valorAnterior?: string;
  valorNovo?: string;
  usuarioNome: string;
  usuarioId?: string;
  timestamp: string;
}

export interface Orcamento {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  numero: string;
  nomeProjeto?: string;
  cliente: string;
  clienteId?: string;
  solicitante: string;
  responsavel?: string;
  dataOrcamento: string;
  dataSolicitacao?: string;
  tiposNota?: ("DANFE" | "NFSE")[];
  prazoPagamento: string;
  prazoEntrega: string;
  observacoes: string;
  frete: string;
  freteValor?: number;
  manuseio?: boolean;
  custoManuseio?: number;
  mostrarHonorarios?: boolean;
  mostrarValorTotalItem?: boolean;
  percHonorarios?: number;
  percImpostos?: number;
  percComissao?: number;
  margemPadrao: number;
  status: StatusOrcamento;
  itens: ItemOrcamento[];
  tags?: string[]; // IDs dos projetos de Planejamento
  documentos?: DocumentoFornecedor[];
  createdAt: string;
  versoes?: VersaoOrcamento[];
  historico?: HistoricoAlteracao[];
  updatedAt?: string;
  updatedById?: string;
  updatedBy?: string;
  participantes?: { userId: string; nome: string }[];
}

// ── Planejamento (ClickUp-style) ─────────────────────

export interface StatusKanban {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

export interface TimeLog {
  id: string;
  startTime: string;
  endTime?: string;
  durationSeconds: number;
}

export interface Tarefa {
  id: string;
  projectId: string;
  parentTaskId?: string;
  statusId: string;
  titulo: string;
  descricao?: string;
  dataVencimento?: string;
  etiquetas: { nome: string; cor: string }[];
  responsaveis: string[];
  ordem: number;
  customFields: Record<string, any>;
  timeTracking: {
    totalSeconds: number;
    logs: TimeLog[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface Projeto {
  id: string;
  nome: string;
  descricao?: string;
  cor: string;
  statuses: StatusKanban[];
  createdAt: string;
  updatedAt: string;
  userId?: string;
  userName?: string;
  participantes?: { userId: string; nome: string }[];
}

// ── Ordem de Serviço (OS) ──────────────────────

export type StatusOS = "Pendente" | "Em produção" | "Pronto" | "Entregue" | "Cancelada";

export const STATUS_OS_CONFIG: Record<StatusOS, { cor: string; bg: string; dot: string }> = {
  "Pendente":    { cor: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-500" },
  "Em produção": { cor: "text-blue-700",   bg: "bg-blue-50 border-blue-200",    dot: "bg-blue-500" },
  "Pronto":      { cor: "text-green-700",  bg: "bg-green-50 border-green-200",   dot: "bg-green-500" },
  "Entregue":    { cor: "text-gray-700",   bg: "bg-gray-100 border-gray-200",    dot: "bg-gray-500" },
  "Cancelada":   { cor: "text-red-700",    bg: "bg-red-50 border-red-200",       dot: "bg-red-500" },
};

export interface ItemOS {
  itemOrcamentoId: string;
  kit: string;
  referencia: string;
  item: string;
  quantidade: number;
  fornecedorId?: string;
  fornecedorNome?: string;
  custoUnitario: number;
  freteProducao: number;
  custoPersonalizacao: number;
  custoEmbalagemIndividual?: number;
  custoEmbalagemTransporte?: number;
  totalCusto: number;
}

export interface OrdemServico {
  id: string;
  numero: string;
  orcamentoId: string;
  orcamentoNumero: string;
  cliente: string;
  clienteId?: string;
  solicitante: string;
  responsavel?: string;
  dataOrcamento: string;
  prazoPagamento: string;
  prazoEntrega: string;
  observacoes: string;
  status: StatusOS;
  itens: ItemOS[];
  criadoAutomaticamente: boolean;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  userName?: string;
  updatedById?: string;
  updatedBy?: string;
  participantes?: { userId: string; nome: string }[];
  // Campos dinâmicos
  camposDinamicos?: Record<string, any>;
  documentos?: DocumentoFornecedor[];
  anotacoesInternas?: AnotacaoInterna[];
  materiais?: MaterialOS[];
  statusFornecedor?: string;
  responsaveis?: Record<string, string>;  // { [processo]: userId }
}

// ── Campos Dinâmicos da OS ─────────────────────

export type TipoCampoDinamico = "texto" | "textarea" | "numero" | "checkbox" | "select" | "multiselect" | "data" | "anexo" | "medida";
export type GrupoCampoDinamico = "detalhamento" | "checklist" | "interno" | "materiais";

export interface CampoDinamicoDef {
  id: string;
  nome: string;
  tipo: TipoCampoDinamico;
  grupo: GrupoCampoDinamico;
  opcoes?: string[];
  visivelCliente: boolean;
  visivelImpressao: boolean;
  obrigatorio?: boolean;
  ordem: number;
  itemVinculado?: boolean;
}

export interface AnotacaoInterna {
  id: string;
  autor: string;
  texto: string;
  createdAt: string;
  parentId?: string;
}

export interface MaterialOS {
  id: string;
  nome: string;
  quantidade: number;
  separado: boolean;
}

// ── Recorrência Personalizada ─────────────────────

export type UnidadeRecorrencia = "dia" | "semana" | "mes" | "ano";
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Domingo

export interface RecorrenciaConfig {
  intervalo: number;
  unidade: UnidadeRecorrencia;
  diasSemana?: DiaSemana[];
  termino: {
    tipo: "nunca" | "em" | "apos";
    data?: string;     // DD/MM/AAAA quando tipo = "em"
    ocorrencias?: number; // quando tipo = "apos"
  };
}
