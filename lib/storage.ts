import type { Orcamento, Fornecedor, Cliente, Produto, Projeto, Tarefa, OrdemServico, ItemOS, VersaoOrcamento } from "@/app/types";
import { dbGet, dbSet } from "./storage-adapter";

// ── Fornecedores ────────────────────────────

async function getFornecedores(): Promise<Fornecedor[]> {
  const lista = await dbGet<Fornecedor[]>("fornecedores", []);
  // Migração: garantir que todo registro tenha id
  let modificou = false;
  const migrados = lista.map((f) => {
    if (!f.id) {
      modificou = true;
      return { ...f, id: `forn${Date.now()}${Math.random().toString(36).slice(2, 8)}` };
    }
    return f;
  });
  if (modificou) await dbSet("fornecedores", migrados);
  return migrados;
}
function salvarDb(fornecedores: Fornecedor[]) {
  return dbSet("fornecedores", fornecedores);
}

export async function listarFornecedores(): Promise<Fornecedor[]> {
  return getFornecedores();
}

export async function buscarFornecedor(id: string): Promise<Fornecedor | undefined> {
  const lista = await getFornecedores();
  return lista.find((f) => f.id === id);
}

export async function salvarFornecedor(fornecedor: Fornecedor): Promise<Fornecedor> {
  const lista = await getFornecedores();
  const idx = lista.findIndex((f) => f.id === fornecedor.id);
  if (idx >= 0) lista[idx] = fornecedor;
  else lista.unshift(fornecedor);
  await salvarDb(lista);
  return fornecedor;
}

export async function deletarFornecedor(id: string): Promise<void> {
  const lista = await getFornecedores();
  await salvarDb(lista.filter((f) => f.id !== id));
}

// ── Clientes ────────────────────────────────

async function getClientes(): Promise<Cliente[]> {
  return dbGet<Cliente[]>("clientes", []);
}

export async function listarClientes(): Promise<Cliente[]> {
  return getClientes();
}

export async function buscarCliente(id: string): Promise<Cliente | undefined> {
  const lista = await getClientes();
  return lista.find((c) => c.id === id);
}

export async function salvarCliente(cliente: Cliente): Promise<Cliente> {
  const lista = await getClientes();
  const idx = lista.findIndex((c) => c.id === cliente.id);
  if (idx >= 0) lista[idx] = cliente;
  else lista.unshift(cliente);
  await dbSet("clientes", lista);
  return cliente;
}

export async function deletarCliente(id: string): Promise<void> {
  const lista = await getClientes();
  await dbSet("clientes", lista.filter((c) => c.id !== id));
}

// ── Produtos ────────────────────────────────

async function getProdutos(): Promise<Produto[]> {
  return dbGet<Produto[]>("produtos", []);
}

export async function listarProdutos(): Promise<Produto[]> {
  return getProdutos();
}

export async function buscarProduto(id: string): Promise<Produto | undefined> {
  const lista = await getProdutos();
  return lista.find((p) => p.id === id);
}

export async function salvarProduto(produto: Produto): Promise<Produto> {
  const lista = await getProdutos();
  const idx = lista.findIndex((p) => p.id === produto.id);
  if (idx >= 0) lista[idx] = produto;
  else lista.unshift(produto);
  await dbSet("produtos", lista);
  return produto;
}

export async function deletarProduto(id: string): Promise<void> {
  const lista = await getProdutos();
  await dbSet("produtos", lista.filter((p) => p.id !== id));
}

export async function sincronizarProdutosBulk(
  novos: Produto[],
  atualizacoes: { id: string; campos: Partial<Produto> }[]
): Promise<void> {
  const porId = new Map((await getProdutos()).map((p) => [p.id, p]));
  for (const { id, campos } of atualizacoes) {
    const existente = porId.get(id);
    if (existente) porId.set(id, { ...existente, ...campos });
  }
  for (const novo of novos) {
    porId.set(novo.id, novo);
  }
  await dbSet("produtos", [...porId.values()]);
}

// ── Contador / Orçamentos ───────────────────

export async function gerarNumeroOrcamento(): Promise<string> {
  const lista = await getOrcamentos();

  // Encontra o maior número existente
  let maxNum = 1669; // começa a partir de 1670
  for (const o of lista) {
    const n = parseInt(o.numero, 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  }

  const numero = String(maxNum + 1);
  return numero;
}

async function getOrcamentos(): Promise<Orcamento[]> {
  return dbGet<Orcamento[]>("orcamentos", []);
}

export async function listarOrcamentos(): Promise<Orcamento[]> {
  return getOrcamentos();
}

export async function buscarOrcamento(id: string): Promise<Orcamento | undefined> {
  const lista = await getOrcamentos();
  return lista.find((o) => o.id === id);
}

export async function salvarOrcamento(orcamento: Orcamento): Promise<Orcamento> {
  const lista = await getOrcamentos();
  const idx = lista.findIndex((o) => o.id === orcamento.id);
  if (idx >= 0) {
    lista[idx] = orcamento;
  } else {
    lista.unshift(orcamento);
  }
  await dbSet("orcamentos", lista);
  return orcamento;
}

export async function deletarOrcamento(id: string): Promise<void> {
  const lista = await getOrcamentos();
  await dbSet("orcamentos", lista.filter((o) => o.id !== id));
}

// ── Versões de Orçamento ────────────────────────

export async function salvarVersao(orcamentoId: string, nome: string, dadosSnapshot: Omit<Orcamento, 'versoes'>): Promise<VersaoOrcamento | null> {
  const lista = await getOrcamentos();
  const idx = lista.findIndex((o) => o.id === orcamentoId);
  if (idx < 0) return null;
  const novaVersao: VersaoOrcamento = {
    id: Math.random().toString(36).substring(2, 10),
    nome,
    dados: dadosSnapshot,
    criadaEm: new Date().toISOString(),
  };
  const orcamento = lista[idx];
  orcamento.versoes = [...(orcamento.versoes || []), novaVersao];
  lista[idx] = orcamento;
  await dbSet("orcamentos", lista);
  return novaVersao;
}

export async function restaurarVersao(orcamentoId: string, versaoId: string): Promise<Omit<Orcamento, 'versoes'> | null> {
  const lista = await getOrcamentos();
  const orcamento = lista.find((o) => o.id === orcamentoId);
  if (!orcamento || !orcamento.versoes) return null;
  const versao = orcamento.versoes.find((v) => v.id === versaoId);
  return versao?.dados ?? null;
}

export async function listarVersoes(orcamentoId: string): Promise<VersaoOrcamento[]> {
  const lista = await getOrcamentos();
  const orcamento = lista.find((o) => o.id === orcamentoId);
  return orcamento?.versoes || [];
}

// ── Sincronização Planejamento ─────────────────

export async function sincronizarTarefasOrcamento(orcamento: Orcamento): Promise<void> {
  if (!orcamento.tags || orcamento.tags.length === 0) return;

  const projetos = await dbGet<Projeto[]>("planejamento", []);
  const tarefas = await dbGet<Tarefa[]>("planejamento-tarefas", []);
  let modificou = false;

  for (const projectId of orcamento.tags) {
    const projeto = projetos.find((p) => p.id === projectId);
    if (!projeto || !projeto.statuses.length) continue;

    // Verifica se já existe tarefa para este orçamento + projeto
    const jaExiste = tarefas.some(
      (t) => t.projectId === projectId && t.customFields?.orcamentoId === orcamento.id
    );
    if (jaExiste) continue;

    const primeiroStatus = [...projeto.statuses].sort((a, b) => a.ordem - b.ordem)[0];
    const maxOrdem = tarefas
      .filter((t) => t.projectId === projectId && t.statusId === primeiroStatus.id)
      .reduce((max, t) => Math.max(max, t.ordem), -1);

    const nova: Tarefa = {
      id: Math.random().toString(36).substring(2, 10),
      projectId,
      statusId: primeiroStatus.id,
      titulo: `Orçamento #${orcamento.numero} - ${orcamento.cliente}`,
      descricao: `Orçamento #${orcamento.numero}\nCliente: ${orcamento.cliente}\nSolicitante: ${orcamento.solicitante}`,
      etiquetas: [{ nome: "Orçamento", cor: "#fb4d06" }],
      responsaveis: [],
      ordem: maxOrdem + 1,
      customFields: { orcamentoId: orcamento.id },
      timeTracking: { totalSeconds: 0, logs: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tarefas.push(nova);
    modificou = true;
  }

  if (modificou) {
    await dbSet("planejamento-tarefas", tarefas);
  }
}

// ── Ordem de Serviço (OS) ──────────────────────

async function getOrdensServico(): Promise<OrdemServico[]> {
  return dbGet<OrdemServico[]>("ordens-servico", []);
}

export async function listarOrdensServico(): Promise<OrdemServico[]> {
  return getOrdensServico();
}

export async function buscarOrdemServico(id: string): Promise<OrdemServico | undefined> {
  const lista = await getOrdensServico();
  return lista.find((o) => o.id === id);
}

export async function salvarOrdemServico(os: OrdemServico): Promise<OrdemServico> {
  const lista = await getOrdensServico();
  const idx = lista.findIndex((o) => o.id === os.id);
  if (idx >= 0) {
    lista[idx] = os;
  } else {
    lista.unshift(os);
  }
  await dbSet("ordens-servico", lista);
  return os;
}

export async function deletarOrdemServico(id: string): Promise<void> {
  const lista = await getOrdensServico();
  await dbSet("ordens-servico", lista.filter((o) => o.id !== id));
}

export async function gerarNumeroOS(): Promise<string> {
  const lista = await getOrdensServico();
  let maxNum = 1000;
  for (const o of lista) {
    const n = parseInt(o.numero, 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  }
  return String(maxNum + 1);
}

export async function gerarOSdeOrcamento(orcamento: Orcamento): Promise<OrdemServico | null> {
  if (orcamento.status !== "Aprovado") return null;

  // Verifica se já existe OS para este orçamento
  const existentes = await getOrdensServico();
  const existente = existentes.find((o) => o.orcamentoId === orcamento.id);
  if (existente) return existente;

  const itensOS: ItemOS[] = orcamento.itens.map((item) => {
    const rateioFrete = item.quantidade > 0 ? item.freteProducao / item.quantidade : 0;
    const rateioPersonalizacao = item.quantidade > 0 ? item.custoPersonalizacao / item.quantidade : 0;
    const rateioEmbalagemTransporte = item.quantidade > 0 ? (item.custoEmbalagemTransporte || 0) / item.quantidade : 0;
    const embalagemInd = item.custoEmbalagemIndividual || 0;

    const custoPorItem = item.custoUnitario + rateioFrete + rateioPersonalizacao + rateioEmbalagemTransporte + embalagemInd;
    const totalCusto = custoPorItem * item.quantidade;

    return {
      itemOrcamentoId: item.id,
      kit: item.kit,
      referencia: item.referencia,
      item: item.item,
      quantidade: item.quantidade,
      fornecedorId: item.fornecedorId,
      fornecedorNome: item.fornecedorNome,
      custoUnitario: item.custoUnitario,
      freteProducao: item.freteProducao,
      custoPersonalizacao: item.custoPersonalizacao,
      custoEmbalagemIndividual: item.custoEmbalagemIndividual,
      custoEmbalagemTransporte: item.custoEmbalagemTransporte,
      totalCusto,
    };
  });

  const agora = new Date().toISOString();
  const nova: OrdemServico = {
    id: Math.random().toString(36).substring(2, 10),
    numero: await gerarNumeroOS(),
    orcamentoId: orcamento.id,
    orcamentoNumero: orcamento.numero,
    cliente: orcamento.cliente,
    clienteId: orcamento.clienteId,
    solicitante: orcamento.solicitante,
    responsavel: orcamento.responsavel,
    dataOrcamento: orcamento.dataOrcamento,
    prazoPagamento: orcamento.prazoPagamento,
    prazoEntrega: orcamento.prazoEntrega,
    observacoes: orcamento.observacoes,
    status: "Pendente",
    itens: itensOS,
    criadoAutomaticamente: true,
    createdAt: agora,
    updatedAt: agora,
  };

  await salvarOrdemServico(nova);
  return nova;
}

// ── Financeiro Kanban (auto-criação ao aprovar) ────────

export async function criarTarefaFinanceira(orcamento: Orcamento): Promise<void> {
  if (orcamento.status !== "Aprovado") return;

  const tarefas = await dbGet<Tarefa[]>("financeiro-planejamento-tarefas", []);

  // Verifica se já existe tarefa pra este orçamento
  const jaExiste = tarefas.some((t) => t.customFields?.orcamentoId === orcamento.id);
  if (jaExiste) return;

  // Pega o ID da primeira coluna
  const colunas = await dbGet<any[]>("financeiro-planejamento-config", []);
  const ordenadas = [...colunas].sort((a, b) => a.ordem - b.ordem);
  const primeiraColuna = ordenadas[0];
  if (!primeiraColuna) return;

  const valorTotal = orcamento.itens.reduce((s, i) => s + (i.total || 0), 0) + ((orcamento.freteValor ?? 0) > 0 ? (orcamento.freteValor ?? 0) : 0);

  const nova: Tarefa = {
    id: Math.random().toString(36).substring(2, 10),
    projectId: "financeiro",
    statusId: primeiraColuna.id,
    titulo: `${orcamento.cliente}${orcamento.nomeProjeto ? ` - ${orcamento.nomeProjeto}` : ""}`,
    descricao: `Orçamento #${orcamento.numero}`,
    dataVencimento: "",
    etiquetas: [],
    responsaveis: [],
    ordem: tarefas.filter((t) => t.statusId === primeiraColuna.id).length,
    customFields: {
      orcamentoId: orcamento.id,
      orcamentoNumero: orcamento.numero,
      orcamentoValor: valorTotal,
    },
    timeTracking: { totalSeconds: 0, logs: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  tarefas.push(nova);
  await dbSet("financeiro-planejamento-tarefas", tarefas);
}
