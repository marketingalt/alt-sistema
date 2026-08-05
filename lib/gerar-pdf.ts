import { NextResponse } from "next/server";
import { buscarOrcamento } from "@/lib/storage";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import React from "react";
import { PdfEspecificacoes, PdfValores, PdfOrdemServico } from "@/lib/pdf-templates";
import { getSystemSettings } from "@/lib/admin";

/** Gera o PDF de um orçamento e retorna o NextResponse pronto (inline ou download). */
export async function gerarPdfResponse(opts: {
  id: string;
  tipo: string;
  preview: boolean;
  logoBase64?: string;
}): Promise<NextResponse> {
  try {
    const { id, tipo, preview, logoBase64: logoOverride } = opts;

    if (!["valores", "especificacoes", "os"].includes(tipo)) {
      return NextResponse.json({ error: "Tipo de PDF inválido" }, { status: 400 });
    }

    const orcamento = await buscarOrcamento(id);
    if (!orcamento) {
      return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
    }

    // Aceita logo: override > orçamento próprio > logo padrão orçamentos > settings global
    let logoBase64: string | undefined;
    if (logoOverride) {
      logoBase64 = logoOverride;
    } else if (orcamento.logoOrcamento) {
      logoBase64 = orcamento.logoOrcamento;
    } else {
      const settings = await getSystemSettings();
      logoBase64 = settings.logoOrcamentoPadrao || settings.logoBase64;
    }

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
