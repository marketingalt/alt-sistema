import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { dbGet } from "@/lib/storage-adapter";
import { getSupabaseAdmin, uploadArquivo, validarArquivo } from "@/lib/supabaseStorage";
import type { Tarefa } from "@/app/types";
import path from "path";

const BUCKET = "planejamento-anexos" as const;

function linhaParaAnexo(row: {
  id: string;
  nome_original: string;
  tipo_mime: string;
  tamanho_bytes: number;
  criado_em: string;
  enviado_por_nome: string | null;
}) {
  return {
    id: row.id,
    nome: row.nome_original,
    tipo: row.tipo_mime,
    tamanho: row.tamanho_bytes,
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
    .from("planejamento_anexos")
    .select("id, nome_original, tipo_mime, tamanho_bytes, criado_em, enviado_por_nome")
    .eq("tarefa_id", id)
    .order("criado_em", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map(linhaParaAnexo));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  // Só aceita anexos para tarefas do board GERAL — nunca do board financeiro (projectId "financeiro")
  const tarefas = await dbGet<Tarefa[]>("planejamento-tarefas", []);
  const tarefa = tarefas.find((t) => t.id === id);
  if (!tarefa) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
  if (tarefa.projectId === "financeiro") {
    return NextResponse.json(
      { error: "Anexos não são suportados no board financeiro de Planejamento" },
      { status: 403 }
    );
  }

  const user = await currentUser();
  const formData = await req.formData();
  const arquivo = formData.get("arquivo") as File;
  if (!arquivo) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const erroValidacao = validarArquivo({ type: arquivo.type, size: arquivo.size }, "planejamento");
  if (erroValidacao) return NextResponse.json({ error: erroValidacao }, { status: 400 });

  const bytes = await arquivo.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const docId = crypto.randomUUID();
  const ext = path.extname(arquivo.name);
  const caminhoStorage = `tarefas/${id}/${docId}${ext}`;

  await uploadArquivo(BUCKET, caminhoStorage, buffer, arquivo.type);

  const nome = user?.fullName || user?.firstName || user?.emailAddresses[0]?.emailAddress || undefined;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("planejamento_anexos")
    .insert({
      id: docId,
      tarefa_id: id,
      nome_original: arquivo.name,
      tipo_mime: arquivo.type,
      tamanho_bytes: arquivo.size,
      caminho_storage: caminhoStorage,
      enviado_por_user_id: userId,
      enviado_por_nome: nome,
    })
    .select("id, nome_original, tipo_mime, tamanho_bytes, criado_em, enviado_por_nome")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Erro ao gravar metadados" }, { status: 500 });
  }

  return NextResponse.json(linhaParaAnexo(data));
}
