import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "reembolsos.json");

export interface Reembolso {
  id: string;
  loteId: string;
  motorista: string;
  email: string;
  dadosBancarios: {
    nome: string;
    banco: string;
    chavePix: string;
    agencia: string;
    conta: string;
  };
  odometroInicial: number;
  dataInicial: string;
  origem: string;
  odometroFinal: number;
  dataFinal: string;
  destino: string;
  distanciaKm: number;
  valorKm: number;
  total: number;
  motivo: string;
  observacao: string;
  status: "pendente" | "pago";
  comprovante: {
    id: string;
    nome: string;
    caminho: string;
    tipo: string;
    tamanho: number;
  } | null;
  contaPagarId: string | null;
  dataVencimento: string;
  dataPagamento?: string;
  createdAt: string;
}

interface ReembolsosDB {
  reembolsos: Reembolso[];
}

function lerBase(): ReembolsosDB {
  try {
    if (!fs.existsSync(DB_PATH)) return { reembolsos: [] };
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  } catch {
    return { reembolsos: [] };
  }
}

function salvarBase(data: ReembolsosDB) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function dirUpload(loteId: string) {
  const dir = path.join(process.cwd(), "data", "uploads", "reembolsos", loteId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function listarReembolsos(): Reembolso[] {
  return lerBase().reembolsos;
}

export function listarReembolsosPorLote(loteId: string): Reembolso[] {
  return lerBase().reembolsos.filter((r) => r.loteId === loteId);
}

export function buscarReembolso(id: string): Reembolso | undefined {
  return lerBase().reembolsos.find((r) => r.id === id);
}

export async function criarReembolso(
  dados: Omit<Reembolso, "id" | "createdAt" | "status" | "comprovante" | "contaPagarId">
): Promise<Reembolso> {
  const base = lerBase();
  const reembolso: Reembolso = {
    ...dados,
    id: `reb${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    status: "pendente",
    comprovante: null,
    contaPagarId: null,
    createdAt: new Date().toISOString(),
  };
  base.reembolsos.push(reembolso);
  salvarBase(base);
  return reembolso;
}

export async function criarLoteReembolsos(
  itens: Omit<Reembolso, "id" | "loteId" | "createdAt" | "status" | "comprovante" | "contaPagarId">[],
  loteId: string
): Promise<Reembolso[]> {
  const base = lerBase();
  const criados: Reembolso[] = [];
  for (const item of itens) {
    const reembolso: Reembolso = {
      ...item,
      id: `reb${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      loteId,
      status: "pendente",
      comprovante: null,
      contaPagarId: null,
      createdAt: new Date().toISOString(),
    };
    base.reembolsos.push(reembolso);
    criados.push(reembolso);
  }
  salvarBase(base);
  return criados;
}

export async function anexarComprovante(
  reembolsoId: string,
  arquivo: File
): Promise<Reembolso | null> {
  const base = lerBase();
  const idx = base.reembolsos.findIndex((r) => r.id === reembolsoId);
  if (idx === -1) return null;

  const bytes = await arquivo.arrayBuffer();
  const docId = Math.random().toString(36).substring(2, 10);
  const ext = path.extname(arquivo.name);
  const nomeArquivo = `${docId}${ext}`;

  const loteId = base.reembolsos[idx].loteId;
  const uploadDir = dirUpload(loteId);
  fs.writeFileSync(path.join(uploadDir, nomeArquivo), Buffer.from(bytes));

  base.reembolsos[idx] = {
    ...base.reembolsos[idx],
    comprovante: {
      id: docId,
      nome: arquivo.name,
      caminho: nomeArquivo,
      tipo: arquivo.type,
      tamanho: arquivo.size,
    },
  };
  salvarBase(base);
  return base.reembolsos[idx];
}

export function marcarComoPago(reembolsoId: string, dataPagamento: string): Reembolso | null {
  const base = lerBase();
  const idx = base.reembolsos.findIndex((r) => r.id === reembolsoId);
  if (idx === -1) return null;

  base.reembolsos[idx] = {
    ...base.reembolsos[idx],
    status: "pago",
    dataPagamento,
  };
  salvarBase(base);
  return base.reembolsos[idx];
}

export function vincularContaPagar(reembolsoId: string, contaPagarId: string): Reembolso | null {
  const base = lerBase();
  const idx = base.reembolsos.findIndex((r) => r.id === reembolsoId);
  if (idx === -1) return null;

  base.reembolsos[idx] = {
    ...base.reembolsos[idx],
    contaPagarId,
  };
  salvarBase(base);
  return base.reembolsos[idx];
}

export function downloadComprovantePath(loteId: string, nomeArquivo: string): string {
  return path.join(process.cwd(), "data", "uploads", "reembolsos", loteId, nomeArquivo);
}
