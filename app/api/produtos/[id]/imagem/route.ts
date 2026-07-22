import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { buscarProduto, salvarProduto } from "@/lib/storage";
import { uploadFile, deleteFile } from "@/lib/storage-file-adapter";

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

    // Try file adapter first (works in both prod and dev)
    await uploadFile("produtos", id, nomeArquivo, buffer);

    // In dev, also write to public/ for backward compatibility with <img> tags
    if (process.env.VERCEL !== "1") {
      if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(path.join(UPLOAD_DIR, nomeArquivo), buffer);
    }

    const imagemUrl = process.env.VERCEL === "1"
      ? nomeArquivo
      : `/uploads/produtos/${nomeArquivo}`;

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

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const produto = await buscarProduto(id);
  if (!produto) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  if (produto.imagemUrl) {
    const nomeArquivo = path.basename(produto.imagemUrl);
    await deleteFile("produtos", id, nomeArquivo);

    // In dev, also remove from public/
    if (process.env.VERCEL !== "1") {
      const caminho = path.join(process.cwd(), "public", produto.imagemUrl);
      try {
        const { unlink } = await import("fs/promises");
        await unlink(caminho);
      } catch {
        // arquivo já removido
      }
    }
  }

  await salvarProduto({ ...produto, imagemUrl: undefined });
  return NextResponse.json({ ok: true });
}
