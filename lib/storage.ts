import type { Orcamento, Fornecedor, Cliente, Produto } from "@/app/types";
import { dbGet, dbSet } from "./storage-adapter";

// ── Fornecedores ────────────────────────────

async function getFornecedores(): Promise<Fornecedor[]> {
  return dbGet<Fornecedor[]>("fornecedores", []);
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
  const numerosExistentes = new Set(lista.map((o) => o.numero));

  let counter = { seq: 1669 };
  try {
    counter = await dbGet<{ seq: number }>("contador", { seq: 1669 });
  } catch { /* usa padrão */ }

  let numero: string;
  do {
    counter.seq += 1;
    numero = String(counter.seq);
  } while (numerosExistentes.has(numero));

  await dbSet("contador", counter);
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
