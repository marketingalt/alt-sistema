import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import { uploadFile } from "@/lib/storage-file-adapter";
import path from "path";

interface FluxoCaixaDB {
  lancamentos: any[];
}
interface ContasPagarDB {
  contas: any[];
}

function lerFC(): Promise<FluxoCaixaDB> {
  return dbGet<FluxoCaixaDB>("fluxo-caixa", { lancamentos: [] });
}
function salvarFC(d: FluxoCaixaDB) {
  return dbSet("fluxo-caixa", d);
}
function lerCP(): Promise<ContasPagarDB> {
  return dbGet<ContasPagarDB>("contas-a-pagar", { contas: [] });
}
function salvarCP(d: ContasPagarDB) {
  return dbSet("contas-a-pagar", d);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dados = await lerFC();
  const lancamento = dados.lancamentos.find((l: any) => l.id === id);
  if (!lancamento)
    return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 });

  const formData = await req.formData();
  const arquivo = formData.get("arquivo") as File;
  if (!arquivo)
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const bytes = await arquivo.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = path.extname(arquivo.name);
  const nomeArquivo = `comprovante${ext}`;

  const caminho = await uploadFile("fluxo-caixa", id, nomeArquivo, buffer);

  // Atualiza o lancamento com comprovanteUrl
  dados.lancamentos = dados.lancamentos.map((l: any) =>
    l.id === id ? { ...l, comprovanteUrl: caminho } : l
  );
  await salvarFC(dados);

  // Sincroniza para a conta a pagar vinculada
  if (lancamento.contaPagarId) {
    const dadosCP = await lerCP();
    dadosCP.contas = dadosCP.contas.map((c: any) =>
      c.id === lancamento.contaPagarId
        ? { ...c, fluxoComprovanteUrl: caminho }
        : c
    );
    await salvarCP(dadosCP);
  }

  return NextResponse.json({ ok: true, comprovanteUrl: caminho });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dados = await lerFC();
  const lancamento = dados.lancamentos.find((l: any) => l.id === id);
  if (!lancamento)
    return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 });

  dados.lancamentos = dados.lancamentos.map((l: any) =>
    l.id === id ? { ...l, comprovanteUrl: undefined } : l
  );
  await salvarFC(dados);

  // Sincroniza para a conta a pagar vinculada
  if (lancamento.contaPagarId) {
    const dadosCP = await lerCP();
    dadosCP.contas = dadosCP.contas.map((c: any) =>
      c.id === lancamento.contaPagarId
        ? { ...c, fluxoComprovanteUrl: undefined }
        : c
    );
    await salvarCP(dadosCP);
  }

  return NextResponse.json({ ok: true });
}
