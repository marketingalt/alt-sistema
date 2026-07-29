import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin, removerArquivo } from "@/lib/supabaseStorage";

const BUCKET = "orcamento-anexos" as const;

type Params = { params: Promise<{ id: string; docId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { id, docId } = await params;
    const supabase = getSupabaseAdmin();
    const { data: doc, error } = await supabase
      .from("orcamento_anexos")
      .select("caminho_storage, nome_original")
      .eq("id", docId)
      .eq("ordem_servico_id", id)
      .single();

    if (error || !doc) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

    const inline = req.nextUrl.searchParams.get("inline") === "1";
    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.caminho_storage, 120, inline ? undefined : { download: doc.nome_original });

    if (signError || !signed) {
      return NextResponse.json({ error: "Erro ao gerar URL do arquivo" }, { status: 500 });
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OS DOCUMENTOS GET ERROR]", msg);
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { id, docId } = await params;
    const supabase = getSupabaseAdmin();
    const { data: doc } = await supabase
      .from("orcamento_anexos")
      .select("caminho_storage")
      .eq("id", docId)
      .eq("ordem_servico_id", id)
      .single();

    if (doc) {
      await removerArquivo(BUCKET, doc.caminho_storage);
    }

    const { error } = await supabase.from("orcamento_anexos").delete().eq("id", docId).eq("ordem_servico_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OS DOCUMENTOS DELETE ERROR]", msg);
    return NextResponse.json({ error: `Erro ao deletar arquivo: ${msg}` }, { status: 500 });
  }
}
