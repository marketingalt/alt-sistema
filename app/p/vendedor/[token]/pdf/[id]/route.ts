import { NextRequest, NextResponse } from "next/server";
import { dbGet } from "@/lib/storage-adapter";
import { buscarOrcamento } from "@/lib/storage";
import { gerarPdfResponse } from "@/lib/gerar-pdf";
import type { Vendedor } from "@/app/api/financeiro/vendas-comissoes/vendedores/route";

export const dynamic = "force-dynamic";

/**
 * PDF público de um orçamento do vendedor.
 * A rota /p/vendedor(.*) já é pública no middleware; aqui validamos o token
 * do link e o vínculo do orçamento com o vendedor (não vaza existência).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  const tipo = req.nextUrl.searchParams.get("tipo") || "valores";
  const preview = req.nextUrl.searchParams.get("preview") === "1";

  const vendedores = await dbGet<Vendedor[]>("financeiro-vendedores", []);
  const vendedor = vendedores.find((v) => v.linkToken === token);
  if (!vendedor || vendedor.ativo !== true) {
    return NextResponse.json({ error: "Link inválido ou revogado" }, { status: 404 });
  }

  const orcamento = await buscarOrcamento(id);
  if (!orcamento || orcamento.vendedorId !== vendedor.id) {
    return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
  }

  return gerarPdfResponse({ id, tipo, preview });
}
