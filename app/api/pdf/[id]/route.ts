import { NextRequest, NextResponse } from "next/server";
import { buscarOrcamento } from "@/lib/storage";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { PdfEspecificacoes, PdfValores } from "@/lib/pdf-templates";
import type { DocumentProps } from "@react-pdf/renderer";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tipo = req.nextUrl.searchParams.get("tipo") || "valores";

  const orcamento = buscarOrcamento(id);
  if (!orcamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const template = (
    tipo === "especificacoes"
      ? React.createElement(PdfEspecificacoes, { orcamento })
      : React.createElement(PdfValores, { orcamento })
  ) as React.ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(template);
  const uint8 = new Uint8Array(buffer);

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="orcamento-${orcamento.numero}-${tipo}.pdf"`,
    },
  });
}
