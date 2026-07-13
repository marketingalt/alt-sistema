import { dbGet, dbSet } from "./storage-adapter";

export interface ReembolsoDespesa {
  id: string;
  data: string;
  cliente: string;
  ordemServicoId?: string;
  ordemServicoNumero?: string;
  descricao: string;
  valor: number;
  pagamento: "cartao_corporativo_c6" | "cartao_corporativo_nubank" | "cartao_pessoal";
  aprovadoPor: string;
  aprovadoPorNome: string;
  status: "pendente" | "pago";
  dataPagamento?: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
}

interface ReembolsosDespesasDB {
  reembolsos: ReembolsoDespesa[];
}

export async function listarReembolsosDespesas(): Promise<ReembolsoDespesa[]> {
  const db = await dbGet<ReembolsosDespesasDB>("reembolsos-despesas", { reembolsos: [] });
  return db.reembolsos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function criarReembolsoDespesa(
  dados: Omit<ReembolsoDespesa, "id" | "createdAt" | "status">
): Promise<ReembolsoDespesa> {
  const db = await dbGet<ReembolsosDespesasDB>("reembolsos-despesas", { reembolsos: [] });
  const novo: ReembolsoDespesa = {
    ...dados,
    id: crypto.randomUUID(),
    status: "pendente",
    createdAt: new Date().toISOString(),
  };
  db.reembolsos.push(novo);
  await dbSet("reembolsos-despesas", db);
  return novo;
}

export async function atualizarReembolsoDespesa(
  id: string,
  dados: Partial<ReembolsoDespesa>
): Promise<ReembolsoDespesa | null> {
  const db = await dbGet<ReembolsosDespesasDB>("reembolsos-despesas", { reembolsos: [] });
  const idx = db.reembolsos.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  db.reembolsos[idx] = { ...db.reembolsos[idx], ...dados };
  await dbSet("reembolsos-despesas", db);
  return db.reembolsos[idx];
}

export async function removerReembolsoDespesa(id: string): Promise<boolean> {
  const db = await dbGet<ReembolsosDespesasDB>("reembolsos-despesas", { reembolsos: [] });
  const antes = db.reembolsos.length;
  db.reembolsos = db.reembolsos.filter((r) => r.id !== id);
  if (db.reembolsos.length === antes) return false;
  await dbSet("reembolsos-despesas", db);
  return true;
}
