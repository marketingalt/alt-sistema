import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import { getSupabaseAdmin, uploadArquivo, removerArquivo, validarArquivo } from "@/lib/supabaseStorage";
import path from "path";

const BUCKET = "financeiro-comprovantes" as const;

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: doc, error } = await supabase
    .from("financeiro_comprovantes")
    .select("caminho_storage, nome_original")
    .eq("tipo_lancamento", "fluxo_caixa")
    .eq("lancamento_id", id)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !doc) return NextResponse.json({ error: "Comprovante não encontrado" }, { status: 404 });

  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.caminho_storage, 120, inline ? undefined : { download: doc.nome_original });

  if (signError || !signed) {
    return NextResponse.json({ error: "Erro ao gerar URL do arquivo" }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const dados = await lerFC();
  const lancamento = dados.lancamentos.find((l: any) => l.id === id);
  if (!lancamento)
    return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 });

  const formData = await req.formData();
  const arquivo = formData.get("arquivo") as File;
  if (!arquivo)
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const erroValidacao = validarArquivo({ type: arquivo.type, size: arquivo.size }, "financeiro");
  if (erroValidacao) return NextResponse.json({ error: erroValidacao }, { status: 400 });

  const bytes = await arquivo.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const docId = crypto.randomUUID();
  const ext = path.extname(arquivo.name);
  const caminhoStorage = `fluxo-caixa/${id}/${docId}${ext}`;

  await uploadArquivo(BUCKET, caminhoStorage, buffer, arquivo.type);

  const supabase = getSupabaseAdmin();

  // Substitui comprovante anterior deste lançamento (1 comprovante por lançamento, igual hoje)
  const { data: antigos } = await supabase
    .from("financeiro_comprovantes")
    .select("caminho_storage")
    .eq("tipo_lancamento", "fluxo_caixa")
    .eq("lancamento_id", id);
  for (const antigo of antigos || []) {
    await removerArquivo(BUCKET, antigo.caminho_storage).catch(() => {});
  }
  await supabase.from("financeiro_comprovantes").delete().eq("tipo_lancamento", "fluxo_caixa").eq("lancamento_id", id);

  const { error } = await supabase.from("financeiro_comprovantes").insert({
    id: docId,
    tipo_lancamento: "fluxo_caixa",
    lancamento_id: id,
    nome_original: arquivo.name,
    tipo_mime: arquivo.type,
    tamanho_bytes: arquivo.size,
    caminho_storage: caminhoStorage,
    enviado_por_user_id: userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  dados.lancamentos = dados.lancamentos.map((l: any) =>
    l.id === id ? { ...l, comprovanteUrl: docId } : l
  );
  await salvarFC(dados);

  // Sinaliza na conta a pagar vinculada que há comprovante (mesma UX de hoje — o arquivo em si
  // continua vivendo só sob o lançamento de fluxo de caixa; a tela de Contas a Pagar lê direto
  // de /api/fluxo-caixa/[id]/comprovante, sem duplicar linha/arquivo).
  if (lancamento.contaPagarId) {
    const dadosCP = await lerCP();
    dadosCP.contas = dadosCP.contas.map((c: any) =>
      c.id === lancamento.contaPagarId ? { ...c, fluxoComprovanteUrl: docId } : c
    );
    await salvarCP(dadosCP);
  }

  return NextResponse.json({ ok: true, comprovanteUrl: docId });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const dados = await lerFC();
  const lancamento = dados.lancamentos.find((l: any) => l.id === id);
  if (!lancamento)
    return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 });

  const supabase = getSupabaseAdmin();
  const { data: docs } = await supabase
    .from("financeiro_comprovantes")
    .select("caminho_storage")
    .eq("tipo_lancamento", "fluxo_caixa")
    .eq("lancamento_id", id);
  for (const doc of docs || []) {
    await removerArquivo(BUCKET, doc.caminho_storage).catch(() => {});
  }
  await supabase.from("financeiro_comprovantes").delete().eq("tipo_lancamento", "fluxo_caixa").eq("lancamento_id", id);

  dados.lancamentos = dados.lancamentos.map((l: any) =>
    l.id === id ? { ...l, comprovanteUrl: undefined } : l
  );
  await salvarFC(dados);

  if (lancamento.contaPagarId) {
    const dadosCP = await lerCP();
    dadosCP.contas = dadosCP.contas.map((c: any) =>
      c.id === lancamento.contaPagarId ? { ...c, fluxoComprovanteUrl: undefined } : c
    );
    await salvarCP(dadosCP);
  }

  return NextResponse.json({ ok: true });
}
