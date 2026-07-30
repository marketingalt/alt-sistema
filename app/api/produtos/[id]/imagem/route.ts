import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { buscarProduto, salvarProduto } from "@/lib/storage";
import { uploadFile, deleteFile, getPublicUrl } from "@/lib/storage-file-adapter";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "produtos");

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const form = await req.formData();
    const arquivo = form.get("imagem") as File | null;
    if (!arquivo) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

    const ext = arquivo.name.split(".").pop() || "jpg";
    const nomeArquivo = `${id}.${ext}`;
    const buffer = Buffer.from(await arquivo.arrayBuffer());

    // Upload via adapter: retorna a URL pública completa do Blob quando configurado,
    // ou o caminho local (gravado em /tmp/ no Vercel sem Blob, já que /var/task/ é
    // read-only lá) quando cai no filesystem.
    const caminhoRetornado = await uploadFile("produtos", id, nomeArquivo, buffer);
    const usaBlob = process.env.BLOB_READ_WRITE_TOKEN !== undefined;

    let imagemUrl: string;
    if (usaBlob) {
      imagemUrl = caminhoRetornado;
    } else if (process.env.VERCEL !== "1") {
      // Dev local: também grava uma cópia em public/ para servir como <img> estático
      if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(path.join(UPLOAD_DIR, nomeArquivo), buffer);
      imagemUrl = `/uploads/produtos/${nomeArquivo}`;
    } else {
      // Vercel sem Blob: public/ é read-only — o adapter já gravou em /tmp/,
      // getPublicUrl aponta para a rota /api/uploads que sabe ler de lá.
      imagemUrl = getPublicUrl("produtos", id, caminhoRetornado);
    }

    // Salva a imagem no registro do produto (cria entrada mínima se for novo)
    const produto = await buscarProduto(id);
    if (produto) {
      await salvarProduto({ ...produto, imagemUrl });
    } else {
      await salvarProduto({ id, imagemUrl } as any);
    }

    return NextResponse.json({ imagemUrl });
  } catch (error) {
    console.error("[IMAGEM POST ERROR]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno ao salvar imagem" },
      { status: 500 }
    );
  }
}

/** É uma URL do nosso próprio bucket Vercel Blob (não uma URL externa qualquer, como o CDN da XBZ). */
function isNossaUrlDoBlob(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const produto = await buscarProduto(id);
  if (!produto) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const imagemUrl = produto.imagemUrl;
  if (imagemUrl) {
    const isBase64 = imagemUrl.startsWith("data:");
    const isBlobUrl = isNossaUrlDoBlob(imagemUrl);
    const isExternaDesconhecida = !isBase64 && !isBlobUrl && /^https?:\/\//.test(imagemUrl);

    if (isBlobUrl) {
      // URL completa do nosso Blob — passa direto para o adapter, sem path.basename
      // (que removeria o "https://" e faria o delete cair no branch de filesystem local por engano).
      await deleteFile("produtos", id, imagemUrl);
    } else if (!isBase64 && !isExternaDesconhecida) {
      // Caminho local (ex: "/uploads/produtos/xxx.png") — extrai só o nome do arquivo
      const nomeArquivo = path.basename(imagemUrl);
      await deleteFile("produtos", id, nomeArquivo);

      if (process.env.VERCEL !== "1") {
        try {
          const { unlink } = await import("fs/promises");
          await unlink(path.join(UPLOAD_DIR, nomeArquivo));
        } catch {
          // arquivo já removido
        }
      }
    }
    // isBase64 (imagem embutida) ou isExternaDesconhecida (ex: CDN da XBZ): nada foi
    // gravado por esta rota, então nada deve ser apagado — nem local, nem no Blob.
  }

  await salvarProduto({ ...produto, imagemUrl: undefined });
  return NextResponse.json({ ok: true });
}
