import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin, uploadArquivo, removerArquivo, validarArquivo } from "@/lib/supabaseStorage";
import path from "path";

const BUCKET = "financeiro-comprovantes" as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orcamentoId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { orcamentoId } = await params;
  const supabase = getSupabaseAdmin();
  const { data: doc, error } = await supabase
    .from("financeiro_comprovantes")
    .select("caminho_storage, nome_original")
    .eq("tipo_lancamento", "contas_a_receber")
    .eq("lancamento_id", orcamentoId)
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
  { params }: { params: Promise<{ orcamentoId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { orcamentoId } = await params;
  const formData = await req.formData();
  const arquivo = formData.get("arquivo") as File;
  if (!arquivo) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const erroValidacao = validarArquivo({ type: arquivo.type, size: arquivo.size }, "financeiro");
  if (erroValidacao) return NextResponse.json({ error: erroValidacao }, { status: 400 });

  const bytes = await arquivo.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const docId = crypto.randomUUID();
  const ext = path.extname(arquivo.name);
  const caminhoStorage = `contas-a-receber/${orcamentoId}/${docId}${ext}`;

  await uploadArquivo(BUCKET, caminhoStorage, buffer, arquivo.type);

  const supabase = getSupabaseAdmin();

  // Um comprovante por lançamento — substitui o anterior, se houver
  const { data: antigos } = await supabase
    .from("financeiro_comprovantes")
    .select("caminho_storage")
    .eq("tipo_lancamento", "contas_a_receber")
    .eq("lancamento_id", orcamentoId);
  for (const antigo of antigos || []) {
    await removerArquivo(BUCKET, antigo.caminho_storage).catch(() => {});
  }
  await supabase.from("financeiro_comprovantes").delete().eq("tipo_lancamento", "contas_a_receber").eq("lancamento_id", orcamentoId);

  const { error } = await supabase.from("financeiro_comprovantes").insert({
    id: docId,
    tipo_lancamento: "contas_a_receber",
    lancamento_id: orcamentoId,
    nome_original: arquivo.name,
    tipo_mime: arquivo.type,
    tamanho_bytes: arquivo.size,
    caminho_storage: caminhoStorage,
    enviado_por_user_id: userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, comprovanteId: docId });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orcamentoId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { orcamentoId } = await params;
  const supabase = getSupabaseAdmin();
  const { data: docs } = await supabase
    .from("financeiro_comprovantes")
    .select("caminho_storage")
    .eq("tipo_lancamento", "contas_a_receber")
    .eq("lancamento_id", orcamentoId);

  for (const doc of docs || []) {
    await removerArquivo(BUCKET, doc.caminho_storage).catch(() => {});
  }
  await supabase.from("financeiro_comprovantes").delete().eq("tipo_lancamento", "contas_a_receber").eq("lancamento_id", orcamentoId);

  return NextResponse.json({ ok: true });
}
