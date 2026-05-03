import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { buscarProduto, salvarProduto } from "@/lib/storage";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "produtos");

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const form = await req.formData();
  const arquivo = form.get("imagem") as File | null;
  if (!arquivo) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

  if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = arquivo.name.split(".").pop() || "jpg";
  const nomeArquivo = `${id}.${ext}`;
  const caminho = path.join(UPLOAD_DIR, nomeArquivo);
  const buffer = Buffer.from(await arquivo.arrayBuffer());
  await writeFile(caminho, buffer);

  const imagemUrl = `/uploads/produtos/${nomeArquivo}`;

  // Atualiza no storage só se o produto já existir (no caso de edição)
  const produto = buscarProduto(id);
  if (produto) salvarProduto({ ...produto, imagemUrl });

  return NextResponse.json({ imagemUrl });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const produto = buscarProduto(id);
  if (!produto) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  if (produto.imagemUrl) {
    const caminho = path.join(process.cwd(), "public", produto.imagemUrl);
    try {
      const { unlink } = await import("fs/promises");
      await unlink(caminho);
    } catch {
      // arquivo já removido
    }
  }

  salvarProduto({ ...produto, imagemUrl: undefined });
  return NextResponse.json({ ok: true });
}
