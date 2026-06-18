import fs from "fs";
import path from "path";
import type { Orcamento, Fornecedor, Cliente, Produto } from "@/app/types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "orcamentos.json");
const COUNTER_PATH = path.join(DATA_DIR, "contador.json");
const FORNECEDORES_PATH = path.join(DATA_DIR, "fornecedores.json");
const CLIENTES_PATH = path.join(DATA_DIR, "clientes.json");
const PRODUTOS_PATH = path.join(DATA_DIR, "produtos.json");

function garantirArquivos() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, "[]");
  if (!fs.existsSync(COUNTER_PATH)) fs.writeFileSync(COUNTER_PATH, JSON.stringify({ seq: 0 }));
  if (!fs.existsSync(FORNECEDORES_PATH)) fs.writeFileSync(FORNECEDORES_PATH, "[]");
  if (!fs.existsSync(CLIENTES_PATH)) fs.writeFileSync(CLIENTES_PATH, "[]");
  if (!fs.existsSync(PRODUTOS_PATH)) fs.writeFileSync(PRODUTOS_PATH, "[]");
}

// Fornecedores
export function listarFornecedores(): Fornecedor[] {
  garantirArquivos();
  return JSON.parse(fs.readFileSync(FORNECEDORES_PATH, "utf-8"));
}

export function buscarFornecedor(id: string): Fornecedor | undefined {
  return listarFornecedores().find((f) => f.id === id);
}

export function salvarFornecedor(fornecedor: Fornecedor): Fornecedor {
  garantirArquivos();
  const lista = listarFornecedores();
  const idx = lista.findIndex((f) => f.id === fornecedor.id);
  if (idx >= 0) lista[idx] = fornecedor;
  else lista.unshift(fornecedor);
  fs.writeFileSync(FORNECEDORES_PATH, JSON.stringify(lista, null, 2));
  return fornecedor;
}

export function deletarFornecedor(id: string): void {
  garantirArquivos();
  const lista = listarFornecedores().filter((f) => f.id !== id);
  fs.writeFileSync(FORNECEDORES_PATH, JSON.stringify(lista, null, 2));
}

// Clientes
export function listarClientes(): Cliente[] {
  garantirArquivos();
  return JSON.parse(fs.readFileSync(CLIENTES_PATH, "utf-8"));
}

export function buscarCliente(id: string): Cliente | undefined {
  return listarClientes().find((c) => c.id === id);
}

export function salvarCliente(cliente: Cliente): Cliente {
  garantirArquivos();
  const lista = listarClientes();
  const idx = lista.findIndex((c) => c.id === cliente.id);
  if (idx >= 0) lista[idx] = cliente;
  else lista.unshift(cliente);
  fs.writeFileSync(CLIENTES_PATH, JSON.stringify(lista, null, 2));
  return cliente;
}

export function deletarCliente(id: string): void {
  garantirArquivos();
  const lista = listarClientes().filter((c) => c.id !== id);
  fs.writeFileSync(CLIENTES_PATH, JSON.stringify(lista, null, 2));
}

// Produtos
export function listarProdutos(): Produto[] {
  garantirArquivos();
  return JSON.parse(fs.readFileSync(PRODUTOS_PATH, "utf-8"));
}

export function buscarProduto(id: string): Produto | undefined {
  return listarProdutos().find((p) => p.id === id);
}

export function salvarProduto(produto: Produto): Produto {
  garantirArquivos();
  const lista = listarProdutos();
  const idx = lista.findIndex((p) => p.id === produto.id);
  if (idx >= 0) lista[idx] = produto;
  else lista.unshift(produto);
  fs.writeFileSync(PRODUTOS_PATH, JSON.stringify(lista, null, 2));
  return produto;
}

export function deletarProduto(id: string): void {
  garantirArquivos();
  const lista = listarProdutos().filter((p) => p.id !== id);
  fs.writeFileSync(PRODUTOS_PATH, JSON.stringify(lista, null, 2));
}

export function sincronizarProdutosBulk(
  novos: Produto[],
  atualizacoes: { id: string; campos: Partial<Produto> }[]
): void {
  garantirArquivos();
  const lista = listarProdutos();
  const porId = new Map(lista.map((p) => [p.id, p]));

  for (const { id, campos } of atualizacoes) {
    const existente = porId.get(id);
    if (existente) porId.set(id, { ...existente, ...campos });
  }

  for (const novo of novos) {
    porId.set(novo.id, novo);
  }

  fs.writeFileSync(PRODUTOS_PATH, JSON.stringify([...porId.values()], null, 2));
}

export function gerarNumeroOrcamento(): string {
  garantirArquivos();
  const lista = listarOrcamentos();
  const numerosExistentes = new Set(lista.map((o) => o.numero));

  // Lê o contador atual e avança sequencialmente
  let counter = { seq: 1669 }; // começa em 1669 → primeira chamada retorna 1670
  try {
    counter = JSON.parse(fs.readFileSync(COUNTER_PATH, "utf-8"));
  } catch { /* usa padrão */ }

  let numero: string;
  do {
    counter.seq += 1;
    numero = String(counter.seq);
  } while (numerosExistentes.has(numero));

  // Salva o novo valor do contador
  fs.writeFileSync(COUNTER_PATH, JSON.stringify(counter));
  return numero;
}

export function listarOrcamentos(): Orcamento[] {
  garantirArquivos();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

export function buscarOrcamento(id: string): Orcamento | undefined {
  return listarOrcamentos().find((o) => o.id === id);
}

export function salvarOrcamento(orcamento: Orcamento): Orcamento {
  garantirArquivos();
  const lista = listarOrcamentos();
  const idx = lista.findIndex((o) => o.id === orcamento.id);
  if (idx >= 0) {
    lista[idx] = orcamento;
  } else {
    lista.unshift(orcamento);
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(lista, null, 2));
  return orcamento;
}

export function deletarOrcamento(id: string): void {
  garantirArquivos();
  const lista = listarOrcamentos().filter((o) => o.id !== id);
  fs.writeFileSync(DB_PATH, JSON.stringify(lista, null, 2));
}
