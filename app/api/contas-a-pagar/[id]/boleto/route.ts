import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import { getSupabaseAdmin, uploadArquivo, removerArquivo, validarArquivo } from "@/lib/supabaseStorage";
import path from "path";

const BUCKET = "financeiro-comprovantes" as const;

interface ContasPagarDB {
  contas: any[];
}

async function ler(): Promise<ContasPagarDB> {
  return dbGet<ContasPagarDB>("contas-a-pagar", { contas: [] });
}
async function salvar(d: ContasPagarDB) {
  await dbSet("contas-a-pagar", d);
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
    .eq("tipo_lancamento", "contas_a_pagar")
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
  const dados = await ler();
  const conta = dados.contas.find((c: any) => c.id === id);
  if (!conta)
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

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
  const caminhoStorage = `contas-a-pagar/${id}/${docId}${ext}`;

  await uploadArquivo(BUCKET, caminhoStorage, buffer, arquivo.type);

  const supabase = getSupabaseAdmin();

  // Substitui o comprovante anterior deste lançamento, se houver (mesmo comportamento de hoje: 1 boleto por conta)
  const { data: antigos } = await supabase
    .from("financeiro_comprovantes")
    .select("id, caminho_storage")
    .eq("tipo_lancamento", "contas_a_pagar")
    .eq("lancamento_id", id);
  for (const antigo of antigos || []) {
    await removerArquivo(BUCKET, antigo.caminho_storage).catch(() => {});
  }
  await supabase.from("financeiro_comprovantes").delete().eq("tipo_lancamento", "contas_a_pagar").eq("lancamento_id", id);

  const { error } = await supabase.from("financeiro_comprovantes").insert({
    id: docId,
    tipo_lancamento: "contas_a_pagar",
    lancamento_id: id,
    nome_original: arquivo.name,
    tipo_mime: arquivo.type,
    tamanho_bytes: arquivo.size,
    caminho_storage: caminhoStorage,
    enviado_por_user_id: userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Marca a conta com o id do comprovante (usado hoje só como flag de "existe boleto")
  dados.contas = dados.contas.map((c: any) =>
    c.id === id ? { ...c, boletoUrl: docId } : c
  );
  await salvar(dados);

  return NextResponse.json({ ok: true, boletoUrl: docId });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: docs } = await supabase
    .from("financeiro_comprovantes")
    .select("caminho_storage")
    .eq("tipo_lancamento", "contas_a_pagar")
    .eq("lancamento_id", id);

  for (const doc of docs || []) {
    await removerArquivo(BUCKET, doc.caminho_storage).catch(() => {});
  }
  await supabase.from("financeiro_comprovantes").delete().eq("tipo_lancamento", "contas_a_pagar").eq("lancamento_id", id);

  const dados = await ler();
  dados.contas = dados.contas.map((c: any) =>
    c.id === id ? { ...c, boletoUrl: undefined } : c
  );
  await salvar(dados);
  return NextResponse.json({ ok: true });
}
