import { NextRequest, NextResponse } from "next/server";
import { buscarOrcamento } from "@/lib/storage";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { PdfEspecificacoes, PdfValores, PdfOrdemServico } from "@/lib/pdf-templates";
import { getSystemSettings } from "@/lib/admin";
import type { DocumentProps } from "@react-pdf/renderer";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tipo = req.nextUrl.searchParams.get("tipo") || "valores";
  const preview = req.nextUrl.searchParams.get("preview") === "1";

  const orcamento = await buscarOrcamento(id);
  if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  // Carrega configurações para obter a logo
  const settings = getSystemSettings();
  const logoBase64 = settings.logoBase64;

  const template = (
    tipo === "especificacoes"
      ? React.createElement(PdfEspecificacoes, { orcamento, logoBase64 })
      : tipo === "os"
      ? React.createElement(PdfOrdemServico, { orcamento, logoBase64 })
      : React.createElement(PdfValores, { orcamento, logoBase64 })
  ) as React.ReactElement<DocumentProps>;

  const filenamePrefix = tipo === "os" ? `os-${orcamento.numero}` : `orcamento-${orcamento.numero}-${tipo}`;

  const buffer = await renderToBuffer(template);
  const uint8 = new Uint8Array(buffer);

  const disposition = preview ? "inline" : `attachment; filename="${filenamePrefix}.pdf"`;

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
    },
  });
}
