import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  listarReembolsos,
  criarLoteReembolsos,
  vincularContaPagar,
  listarReembolsosPorLote,
  buscarReembolso,
} from "@/lib/reembolsos";
import { readFile } from "@/lib/storage-file-adapter";
import { dbGet, dbSet } from "@/lib/storage-adapter";

// ── helpers para criar contas a pagar via storage adapter ──
async function criarContaPagar(dados: {
  dataVencimento: string;
  fornecedor: string;
  descricao: string;
  valor: number;
  modalidade: string;
  banco: string;
  area: string;
  categoria: string;
  dadosBancarios: Record<string, string>;
  reembolsoId: string;
  ordemServicoId?: string;
}): Promise<string> {
  const db = await dbGet<any>("contas-a-pagar", { contas: [] });
  const id = `cp${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const nova = {
    ...dados,
    id,
    status: "pendente",
    createdAt: new Date().toISOString().split("T")[0],
  };
  db.contas.push(nova);
  await dbSet("contas-a-pagar", db);
  return id;
}

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

      // Criar contas a pagar automaticamente
      const contasCriadas: { reembolsoId: string; contaPagarId: string }[] = [];
      for (const reb of reembolsos) {
        const contaPagarId = await criarContaPagar({
          dataVencimento: reb.dataVencimento || reb.dataFinal,
          fornecedor: `Reembolso — ${reb.motorista}`,
          descricao: `${reb.motivo ? reb.motivo + " — " : ""}${reb.origem} → ${reb.destino} (${reb.distanciaKm} km)`,
          valor: reb.total,
          modalidade: "PIX",
          banco: reb.dadosBancarios.banco || "C6 BANK",
          area: "PROJETOS",
          categoria: "CUSTOS DIRETOS DOS SERVIÇOS",
          dadosBancarios: reb.dadosBancarios,
          reembolsoId: reb.id,
          ordemServicoId: reb.ordemServicoId,
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
