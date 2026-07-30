import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;

  // Tenta primeiro em data/uploads (local dev)
  const localPath = path.join(process.cwd(), "data", "uploads", ...slug);
  if (fs.existsSync(localPath)) {
    return serveFile(localPath);
  }

  // No Vercel sem Blob, os uploads vão para /tmp/data/uploads/
  const tmpPath = path.join("/tmp/data/uploads", ...slug);
  if (fs.existsSync(tmpPath)) {
    return serveFile(tmpPath);
  }

  return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
}

function serveFile(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mime[ext] || "application/octet-stream",
      "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
