import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { listarOrcamentos, salvarOrcamento, sincronizarTarefasOrcamento, gerarOSdeOrcamento } from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabaseStorage";
import type { HistoricoAlteracao, DocumentoFornecedor } from "@/app/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const lista = await listarOrcamentos();

  // Anexa os anexos (Supabase) de cada orçamento, para manter o indicador "PO" da listagem funcionando
  try {
    const supabase = getSupabaseAdmin();
    const { data: anexos } = await supabase
      .from("orcamento_anexos")
      .select("id, orcamento_id, nome_original, tipo_mime, tamanho_bytes, caminho_storage, criado_em, enviado_por_nome")
      .not("orcamento_id", "is", null);

    const porOrcamento = new Map<string, DocumentoFornecedor[]>();
    for (const row of anexos || []) {
      const doc: DocumentoFornecedor = {
        id: row.id,
        nome: row.nome_original,
        tipo: row.tipo_mime,
        tamanho: row.tamanho_bytes,
        caminho: row.caminho_storage,
        uploadedAt: row.criado_em,
        uploadedBy: row.enviado_por_nome || undefined,
      };
      const atual = porOrcamento.get(row.orcamento_id) || [];
      atual.push(doc);
      porOrcamento.set(row.orcamento_id, atual);
    }
    for (const o of lista) {
      o.documentos = porOrcamento.get(o.id) || [];
    }
  } catch (err) {
    console.error("[ORCAMENTOS LIST ANEXOS ERROR]", err);
  }

  return NextResponse.json(lista, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    const orcamento = await req.json();
    if (!orcamento || !orcamento.id) {
      return NextResponse.json({ error: "Dados do orçamento inválidos" }, { status: 400 });
    }

    const nomeUsuario = user?.fullName || user?.firstName || "Desconhecido";

    const entradaCriacao: HistoricoAlteracao = {
      id: Math.random().toString(36).substring(2, 10),
      tipo: "criacao",
      descricao: "Orçamento criado",
      usuarioNome: nomeUsuario,
      usuarioId: userId || undefined,
      timestamp: new Date().toISOString(),
    };

    const salvo = await salvarOrcamento({
      ...orcamento,
      userId: userId || undefined,
      userEmail: user?.emailAddresses[0]?.emailAddress || undefined,
      userName: nomeUsuario,
      historico: [entradaCriacao],
    });

    // Sincronizar tarefas no Planejamento
    sincronizarTarefasOrcamento(salvo).catch((err) =>
      console.error("[ORCAMENTO SYNC ERROR]", err)
    );

    // Gerar OS automaticamente se o orçamento foi aprovado
    gerarOSdeOrcamento(salvo).catch((err) =>
      console.error("[ORCAMENTO OS ERROR]", err)
    );

    return NextResponse.json(salvo, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST ORCAMENTO ERROR]", msg);
    return NextResponse.json({ error: `Erro ao salvar: ${msg}` }, { status: 500 });
  }
}
