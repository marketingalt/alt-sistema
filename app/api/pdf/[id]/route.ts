import { NextRequest, NextResponse } from "next/server";
import { gerarPdfResponse } from "@/lib/gerar-pdf";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tipo = req.nextUrl.searchParams.get("tipo") || "valores";
  const preview = req.nextUrl.searchParams.get("preview") === "1";
  return gerarPdfResponse({ id, tipo, preview });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tipo = req.nextUrl.searchParams.get("tipo") || "valores";
  const preview = req.nextUrl.searchParams.get("preview") === "1";
  let logoBase64: string | undefined;
  try {
    const body = await req.json();
    logoBase64 = body.logoBase64 || undefined;
  } catch {}
  return gerarPdfResponse({ id, tipo, preview, logoBase64 });
}
