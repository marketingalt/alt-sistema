import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { buscarOrdemServico } from "@/lib/storage";
import { getSupabaseAdmin, uploadArquivo, validarArquivo } from "@/lib/supabaseStorage";
import type { DocumentoFornecedor } from "@/app/types";
import path from "path";

const BUCKET = "orcamento-anexos" as const;

function linhaParaDocumento(row: {
  id: string;
  nome_original: string;
  tipo_mime: string;
  tamanho_bytes: number;
  caminho_storage: string;
  criado_em: string;
  enviado_por_nome: string | null;
}): DocumentoFornecedor {
  return {
    id: row.id,
    nome: row.nome_original,
    tipo: row.tipo_mime,
    tamanho: row.tamanho_bytes,
    caminho: row.caminho_storage,
    uploadedAt: row.criado_em,
    uploadedBy: row.enviado_por_nome || undefined,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("orcamento_anexos")
    .select("id, nome_original, tipo_mime, tamanho_bytes, caminho_storage, criado_em, enviado_por_nome")
    .eq("ordem_servico_id", id)
    .order("criado_em", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map(linhaParaDocumento));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { id } = await params;
    const os = await buscarOrdemServico(id);
    if (!os) return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });

    const user = await currentUser();
    const formData = await req.formData();
    const arquivo = formData.get("arquivo") as File;
    if (!arquivo) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

    const erroValidacao = validarArquivo({ type: arquivo.type, size: arquivo.size }, "orcamento");
    if (erroValidacao) return NextResponse.json({ error: erroValidacao }, { status: 400 });

    const bytes = await arquivo.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const docId = crypto.randomUUID();
    const ext = path.extname(arquivo.name);
    const caminhoStorage = `ordens-servico/${id}/${docId}${ext}`;

    await uploadArquivo(BUCKET, caminhoStorage, buffer, arquivo.type);

    const nome = user?.fullName || user?.firstName || user?.emailAddresses[0]?.emailAddress || undefined;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("orcamento_anexos")
      .insert({
        id: docId,
        ordem_servico_id: id,
        nome_original: arquivo.name,
        tipo_mime: arquivo.type,
        tamanho_bytes: arquivo.size,
        caminho_storage: caminhoStorage,
        enviado_por_user_id: userId,
        enviado_por_nome: nome,
      })
      .select("id, nome_original, tipo_mime, tamanho_bytes, caminho_storage, criado_em, enviado_por_nome")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Erro ao gravar metadados" }, { status: 500 });
    }

    return NextResponse.json(linhaParaDocumento(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OS DOCUMENTOS UPLOAD ERROR]", msg);
    return NextResponse.json({ error: `Erro ao enviar arquivo: ${msg}` }, { status: 500 });
  }
}
