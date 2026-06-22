import path from "path";
import { uploadFile, deleteFile, readFile } from "@/lib/storage-file-adapter";
import { dbGet, dbSet } from "@/lib/storage-adapter";

export interface DocumentoRH {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  caminho: string;
  uploadedAt: string;
  uploadedBy: string;
  categoria: string; // ex: "contrato", "ficha", "doc pessoal", "outro"
}

interface DocumentosPorEmail {
  [email: string]: DocumentoRH[];
}

async function lerBase(): Promise<DocumentosPorEmail> {
  try {
    return await dbGet<DocumentosPorEmail>("documentos-rh", {});
  } catch {
    return {};
  }
}

async function salvarBase(data: DocumentosPorEmail) {
  await dbSet("documentos-rh", data);
}

function emailToDir(email: string): string {
  return email.replace(/[^a-zA-Z0-9]/g, "_");
}

export async function getDocumentos(email: string): Promise<DocumentoRH[]> {
  const base = await lerBase();
  return base[email] || [];
}

export async function adicionarDocumento(
  email: string,
  arquivo: File,
  categoria: string,
  uploadedBy: string
): Promise<DocumentoRH> {
  const bytes = await arquivo.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const docId = Math.random().toString(36).substring(2, 10);
  const ext = path.extname(arquivo.name);
  const nomeArquivo = `${docId}${ext}`;

  const safe = emailToDir(email);
  await uploadFile("rh", safe, nomeArquivo, buffer);

  const doc: DocumentoRH = {
    id: docId,
    nome: arquivo.name,
    tipo: arquivo.type,
    tamanho: arquivo.size,
    caminho: nomeArquivo,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
    categoria,
  };

  const base = await lerBase();
  if (!base[email]) base[email] = [];
  base[email].push(doc);
  await salvarBase(base);

  return doc;
}

export async function removerDocumento(email: string, docId: string): Promise<boolean> {
  const base = await lerBase();
  if (!base[email]) return false;

  const idx = base[email].findIndex((d) => d.id === docId);
  if (idx === -1) return false;

  const doc = base[email][idx];
  const safe = emailToDir(email);
  await deleteFile("rh", safe, doc.caminho);

  base[email].splice(idx, 1);
  await salvarBase(base);
  return true;
}

export async function downloadPath(email: string, docId: string): Promise<string | null> {
  const base = await lerBase();
  if (!base[email]) return null;
  const doc = base[email].find((d) => d.id === docId);
  if (!doc) return null;

  if (process.env.VERCEL === "1" || process.env.BLOB_READ_WRITE_TOKEN) {
    return null;
  }

  const safe = emailToDir(email);
  return path.join(process.cwd(), "data", "uploads", "rh", safe, doc.caminho);
}
