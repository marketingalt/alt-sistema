import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import React from "react";
import { PdfFluxoCaixa, PdfContasPagar, PdfContasReceber } from "@/lib/pdf-financeiro";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tipo, titulo, periodo, ...rest } = body;

    let Componente: React.ComponentType<any>;

    switch (tipo) {
      case "fluxo-caixa":
        Componente = PdfFluxoCaixa;
        break;
      case "contas-pagar":
        Componente = PdfContasPagar;
        break;
      case "contas-receber":
        Componente = PdfContasReceber;
        break;
      default:
        return NextResponse.json({ error: "Tipo de PDF inválido" }, { status: 400 });
    }

    const template = React.createElement(Componente, { titulo, periodo, ...rest }) as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(template);
    const uint8 = new Uint8Array(buffer);
    const filename = `${tipo}_${periodo.replace(/\//g, "-")}.pdf`;

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(uint8.byteLength),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[PDF FINANCEIRO ERROR]", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return NextResponse.json(
      { error: "Erro ao gerar PDF. Tente novamente." },
      { status: 500 }
    );
  }
}
