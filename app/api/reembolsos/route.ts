import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  listarReembolsos,
  criarLoteReembolsos,
  vincularContaPagar,
  listarReembolsosPorLote,
  buscarReembolso,
  criarOuAtualizarLoteContaPagar,
} from "@/lib/reembolsos";
import { readFile } from "@/lib/storage-file-adapter";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const loteId = searchParams.get("lote");
    const downloadRebId = searchParams.get("download");

    // Download de comprovante
    if (downloadRebId) {
      const reembolso = await buscarReembolso(downloadRebId);
      if (!reembolso || !reembolso.comprovante) {
        return NextResponse.json({ error: "Comprovante não encontrado" }, { status: 404 });
      }
      try {
        const buffer = await readFile("reembolsos", reembolso.loteId, reembolso.comprovante.caminho);
        return new Response(new Blob([buffer], { type: reembolso.comprovante.tipo || "application/octet-stream" }), {
          headers: {
            "Content-Disposition": `inline; filename="${reembolso.comprovante.nome}"`,
          },
        });
      } catch {
        return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
      }
    }

    const reembolsos = loteId
      ? await listarReembolsosPorLote(loteId)
      : await listarReembolsos();

    // Ordenar do mais recente primeiro
    reembolsos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(reembolsos);
  } catch (err) {
    console.error("Erro ao listar reembolsos:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const user = await currentUser();
    const email = user?.emailAddresses[0]?.emailAddress || "";

    const body = await req.json();

    // ── Criação em lote ──
    if (body.lote && Array.isArray(body.itens)) {
      const loteId = `lote${Date.now()}`;
      const ordemServicoId = body.ordemServicoId || undefined;

      // Propagar ordemServicoId para os itens
      const itensComOS = body.itens.map((item: any) => ({
        ...item,
        ordemServicoId: ordemServicoId || item.ordemServicoId || undefined,
      }));

      const reembolsos = await criarLoteReembolsos(itensComOS, loteId);

      // Criar contas a pagar em lote por dataVencimento
      const contasCriadas: { reembolsoId: string; contaPagarId: string }[] = [];
      for (const reb of reembolsos) {
        const dataVenc = reb.dataVencimento || reb.dataFinal;
        const descricao = `${reb.motivo ? reb.motivo + " — " : ""}${reb.origem} → ${reb.destino} (${reb.distanciaKm} km)`;
        const contaPagarId = await criarOuAtualizarLoteContaPagar({
          dataVencimento: dataVenc,
          tipo: "logistica",
          reembolsoId: reb.id,
          descricao,
          valor: reb.total,
          modalidade: "PIX",
          banco: reb.dadosBancarios.banco || "C6 BANK",
          area: "PROJETOS",
          categoria: "CUSTOS DIRETOS DOS SERVIÇOS",
        });
        await vincularContaPagar(reb.id, contaPagarId);
        contasCriadas.push({ reembolsoId: reb.id, contaPagarId });
      }

      return NextResponse.json({ loteId, reembolsos, contasCriadas }, { status: 201 });
    }

    return NextResponse.json({ error: "Envie 'lote' com 'itens' para criar reembolsos" }, { status: 400 });
  } catch (err) {
    console.error("Erro ao criar reembolsos:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
