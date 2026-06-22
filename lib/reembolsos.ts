import path from "path";
import { dbGet, dbSet } from "./storage-adapter";
import { uploadFile, deleteFile, readFile } from "./storage-file-adapter";

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

async function lerBase(): Promise<ReembolsosDB> {
  try {
    return await dbGet<ReembolsosDB>("reembolsos", { reembolsos: [] });
  } catch {
    return { reembolsos: [] };
  }
}

async function salvarBase(data: ReembolsosDB) {
  await dbSet("reembolsos", data);
}

export async function listarReembolsos(): Promise<Reembolso[]> {
  const base = await lerBase();
  return base.reembolsos;
}

export async function listarReembolsosPorLote(loteId: string): Promise<Reembolso[]> {
  const base = await lerBase();
  return base.reembolsos.filter((r) => r.loteId === loteId);
}

export async function buscarReembolso(id: string): Promise<Reembolso | undefined> {
  const base = await lerBase();
  return base.reembolsos.find((r) => r.id === id);
}

export async function criarReembolso(
  dados: Omit<Reembolso, "id" | "createdAt" | "status" | "comprovante" | "contaPagarId">
): Promise<Reembolso> {
  const base = await lerBase();
  const reembolso: Reembolso = {
    ...dados,
    id: `reb${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    status: "pendente",
    comprovante: null,
    contaPagarId: null,
    createdAt: new Date().toISOString(),
  };
  base.reembolsos.push(reembolso);
  await salvarBase(base);
  return reembolso;
}

export async function criarLoteReembolsos(
  itens: Omit<Reembolso, "id" | "loteId" | "createdAt" | "status" | "comprovante" | "contaPagarId">[],
  loteId: string
): Promise<Reembolso[]> {
  const base = await lerBase();
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
  await salvarBase(base);
  return criados;
}

export async function anexarComprovante(
  reembolsoId: string,
  arquivo: File
): Promise<Reembolso | null> {
  const base = await lerBase();
  const idx = base.reembolsos.findIndex((r) => r.id === reembolsoId);
  if (idx === -1) return null;

  const bytes = await arquivo.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const docId = Math.random().toString(36).substring(2, 10);
  const ext = path.extname(arquivo.name);
  const nomeArquivo = `${docId}${ext}`;

  const loteId = base.reembolsos[idx].loteId;
  const storedPath = await uploadFile("reembolsos", loteId, nomeArquivo, buffer);

  base.reembolsos[idx] = {
    ...base.reembolsos[idx],
    comprovante: {
      id: docId,
      nome: arquivo.name,
      caminho: storedPath,
      tipo: arquivo.type,
      tamanho: arquivo.size,
    },
  };
  await salvarBase(base);
  return base.reembolsos[idx];
}

export async function marcarComoPago(reembolsoId: string, dataPagamento: string): Promise<Reembolso | null> {
  const base = await lerBase();
  const idx = base.reembolsos.findIndex((r) => r.id === reembolsoId);
  if (idx === -1) return null;

  base.reembolsos[idx] = {
    ...base.reembolsos[idx],
    status: "pago",
    dataPagamento,
  };
  await salvarBase(base);
  return base.reembolsos[idx];
}

export async function vincularContaPagar(reembolsoId: string, contaPagarId: string): Promise<Reembolso | null> {
  const base = await lerBase();
  const idx = base.reembolsos.findIndex((r) => r.id === reembolsoId);
  if (idx === -1) return null;

  base.reembolsos[idx] = {
    ...base.reembolsos[idx],
    contaPagarId,
  };
  await salvarBase(base);
  return base.reembolsos[idx];
}

export async function downloadComprovantePath(loteId: string, nomeArquivo: string): Promise<string> {
  // For local dev, return the filesystem path; for prod, the caller reads via readFile
  if (process.env.VERCEL === "1" || process.env.BLOB_READ_WRITE_TOKEN) {
    return nomeArquivo; // will be resolved by readFile in the route
  }
  return path.join(process.cwd(), "data", "uploads", "reembolsos", loteId, nomeArquivo);
}
