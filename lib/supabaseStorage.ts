import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Client único, server-side apenas — usa a service role key, nunca exposta ao browser. */
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados");
  }
  client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return client;
}

export type BucketAnexo = "orcamento-anexos" | "financeiro-comprovantes" | "planejamento-anexos";
export type ContextoValidacao = "orcamento" | "financeiro" | "planejamento";

const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10MB

const MIME_FINANCEIRO = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const MIME_ORCAMENTO_PLANEJAMENTO = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
];

/**
 * Valida tamanho e tipo MIME antes de qualquer upload.
 * Retorna uma mensagem de erro (string) se inválido, ou null se ok.
 */
export function validarArquivo(
  arquivo: { type: string; size: number },
  contexto: ContextoValidacao
): string | null {
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return `Arquivo maior que o limite de ${TAMANHO_MAXIMO_BYTES / (1024 * 1024)}MB.`;
  }
  const permitidos = contexto === "financeiro" ? MIME_FINANCEIRO : MIME_ORCAMENTO_PLANEJAMENTO;
  if (!permitidos.includes(arquivo.type)) {
    return `Tipo de arquivo não permitido (${arquivo.type || "desconhecido"}).`;
  }
  return null;
}

/** Envia o arquivo para o bucket privado. Lança erro se falhar — nada é gravado no Postgres antes disso ter sucesso. */
export async function uploadArquivo(
  bucket: BucketAnexo,
  caminho: string,
  buffer: Buffer,
  tipoMime: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).upload(caminho, buffer, {
    contentType: tipoMime,
    upsert: false,
  });
  if (error) throw new Error(`Erro ao enviar arquivo para o Storage: ${error.message}`);
}

/** Gera uma signed URL de curta duração para visualização/download. */
export async function gerarUrlAssinada(
  bucket: BucketAnexo,
  caminho: string,
  expiraEmSegundos = 120
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(caminho, expiraEmSegundos);
  if (error || !data) throw new Error(`Erro ao gerar URL assinada: ${error?.message || "desconhecido"}`);
  return data.signedUrl;
}

/** Remove o objeto do bucket. Não lança se o objeto já não existir mais. */
export async function removerArquivo(bucket: BucketAnexo, caminho: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).remove([caminho]);
  if (error) throw new Error(`Erro ao remover arquivo do Storage: ${error.message}`);
}

export type TabelaAnexo = "orcamento_anexos" | "financeiro_comprovantes" | "planejamento_anexos";

/**
 * Remove todos os anexos (arquivo no bucket + linha de metadados) que casam com o filtro dado.
 * Usado ao excluir o registro "pai" (orçamento, OS, lançamento financeiro, tarefa de planejamento)
 * para não deixar arquivos/linhas órfãs. Nunca lança — falhas de limpeza são logadas e ignoradas,
 * para não bloquear a exclusão do registro principal.
 */
export async function limparAnexosVinculados(
  tabela: TabelaAnexo,
  bucket: BucketAnexo,
  filtro: Record<string, string>
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase.from(tabela).select("caminho_storage");
    for (const [coluna, valor] of Object.entries(filtro)) query = query.eq(coluna, valor);
    const { data, error: erroSelect } = await query;
    if (erroSelect) {
      console.error(`[limparAnexosVinculados] falha ao consultar ${tabela} (nada será removido):`, erroSelect.message);
    }

    for (const row of (data as { caminho_storage: string }[] | null) || []) {
      await removerArquivo(bucket, row.caminho_storage).catch((err) =>
        console.error(`[limparAnexosVinculados] falha ao remover arquivo do bucket ${bucket}:`, err)
      );
    }

    let del = supabase.from(tabela).delete();
    for (const [coluna, valor] of Object.entries(filtro)) del = del.eq(coluna, valor);
    const { error } = await del;
    if (error) console.error(`[limparAnexosVinculados] falha ao apagar linhas de ${tabela}:`, error.message);
  } catch (err) {
    console.error(`[limparAnexosVinculados] erro inesperado (${tabela}):`, err);
  }
}
