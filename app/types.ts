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

export interface ItemOrcamento {
  id: string;
  kit: string;
  referencia: string;
  fornecedorId?: string;
  fornecedorNome?: string;
  item: string;
  cor?: string;
  ncm?: string;
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
  valorUnitario: number;       // preço final ao cliente
  valorAjustado: boolean;      // true = usuário sobrescreveu o valor calculado
  total: number;
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
  // Meta
  createdAt: string;
  userId?: string;
  userName?: string;
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
  // Meta
  createdAt: string;
  userId?: string;
  userName?: string;
}

export interface Produto {
  id: string;
  sku: string;
  nome: string;
  marca: string;
  precoCusto: number;
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
  percHonorarios?: number;
  percImpostos?: number;
  percComissao?: number;
  margemPadrao: number;
  status: StatusOrcamento;
  itens: ItemOrcamento[];
  documentos?: DocumentoFornecedor[];
  createdAt: string;
}

// ── Planejamento / Kanban ────────────────────────────

export interface CartaoKanban {
  id: string;
  titulo: string;
  descricao?: string;
  dataVencimento?: string;
  etiquetas: { nome: string; cor: string }[];
  membros: string[];
  createdAt: string;
}

export interface ColunaKanban {
  id: string;
  nome: string;
  cartoes: CartaoKanban[];
}

export interface Projeto {
  id: string;
  nome: string;
  descricao?: string;
  cor: string;
  colunas: ColunaKanban[];
  createdAt: string;
  updatedAt: string;
}
