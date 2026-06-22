import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "documentos-rh.json");

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

function lerBase(): DocumentosPorEmail {
  try {
    if (!fs.existsSync(DB_PATH)) return {};
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function salvarBase(data: DocumentosPorEmail) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function dirUpload(email: string) {
  const safe = email.replace(/[^a-zA-Z0-9]/g, "_");
  const dir = path.join(process.cwd(), "data", "uploads", "rh", safe);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDocumentos(email: string): DocumentoRH[] {
  const base = lerBase();
  return base[email] || [];
}

export async function adicionarDocumento(
  email: string,
  arquivo: File,
  categoria: string,
  uploadedBy: string
): Promise<DocumentoRH> {
  const bytes = await arquivo.arrayBuffer();
  const docId = Math.random().toString(36).substring(2, 10);
  const ext = path.extname(arquivo.name);
  const nomeArquivo = `${docId}${ext}`;

  const uploadDir = dirUpload(email);
  fs.writeFileSync(path.join(uploadDir, nomeArquivo), Buffer.from(bytes));

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

  const base = lerBase();
  if (!base[email]) base[email] = [];
  base[email].push(doc);
  salvarBase(base);

  return doc;
}

export function removerDocumento(email: string, docId: string): boolean {
  const base = lerBase();
  if (!base[email]) return false;

  const idx = base[email].findIndex((d) => d.id === docId);
  if (idx === -1) return false;

  const doc = base[email][idx];
  const safe = email.replace(/[^a-zA-Z0-9]/g, "_");
  const caminho = path.join(process.cwd(), "data", "uploads", "rh", safe, doc.caminho);
  try { fs.unlinkSync(caminho); } catch { /* arquivo já pode ter sido removido */ }

  base[email].splice(idx, 1);
  salvarBase(base);
  return true;
}

export function downloadPath(email: string, docId: string): string | null {
  const base = lerBase();
  if (!base[email]) return null;
  const doc = base[email].find((d) => d.id === docId);
  if (!doc) return null;
  const safe = email.replace(/[^a-zA-Z0-9]/g, "_");
  return path.join(process.cwd(), "data", "uploads", "rh", safe, doc.caminho);
}
