import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import { uploadFile } from "@/lib/storage-file-adapter";
import path from "path";

interface ContasPagarDB {
  contas: any[];
}

async function ler(): Promise<ContasPagarDB> {
  return dbGet<ContasPagarDB>("contas-a-pagar", { contas: [] });
}
async function salvar(d: ContasPagarDB) {
  await dbSet("contas-a-pagar", d);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dados = await ler();
  const conta = dados.contas.find((c: any) => c.id === id);
  if (!conta)
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  const formData = await req.formData();
  const arquivo = formData.get("arquivo") as File;
  if (!arquivo)
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const bytes = await arquivo.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = path.extname(arquivo.name);
  const nomeArquivo = `boleto${ext}`;

  const caminho = await uploadFile("contas-a-pagar", id, nomeArquivo, buffer);

  // Atualiza a conta com o boletoUrl
  dados.contas = dados.contas.map((c: any) =>
    c.id === id ? { ...c, boletoUrl: caminho } : c
  );
  await salvar(dados);

  return NextResponse.json({ ok: true, boletoUrl: caminho });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dados = await ler();
  dados.contas = dados.contas.map((c: any) =>
    c.id === id ? { ...c, boletoUrl: undefined } : c
  );
  await salvar(dados);
  return NextResponse.json({ ok: true });
}
