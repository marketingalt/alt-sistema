import { NextRequest, NextResponse } from "next/server";
import { buscarOrcamento } from "@/lib/storage";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import React from "react";
import { PdfEspecificacoes, PdfValores, PdfOrdemServico } from "@/lib/pdf-templates";
import { getSystemSettings } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tipo = req.nextUrl.searchParams.get("tipo") || "valores";
    const preview = req.nextUrl.searchParams.get("preview") === "1";

    if (!["valores", "especificacoes", "os"].includes(tipo)) {
      return NextResponse.json({ error: "Tipo de PDF inválido" }, { status: 400 });
    }

    const orcamento = await buscarOrcamento(id);
    if (!orcamento) {
      return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
    }

    const settings = await getSystemSettings();
    const logoBase64 = settings.logoBase64;

    const Componente =
      tipo === "especificacoes"
        ? PdfEspecificacoes
        : tipo === "os"
          ? PdfOrdemServico
          : PdfValores;

    const template = React.createElement(Componente, { orcamento, logoBase64 }) as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(template);
    const uint8 = new Uint8Array(buffer);

    const filenamePrefix = tipo === "os"
      ? `os-${orcamento.numero}`
      : `orcamento-${orcamento.numero}-${tipo}`;

    const disposition = preview
      ? `inline; filename="${filenamePrefix}.pdf"`
      : `attachment; filename="${filenamePrefix}.pdf"`;

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Content-Length": String(uint8.byteLength),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (error) {
    console.error("[PDF ERROR]", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return NextResponse.json(
      { error: "Erro ao gerar PDF. Tente novamente." },
      { status: 500 }
    );
  }
}
