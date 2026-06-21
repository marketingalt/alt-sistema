import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  listarReembolsos,
  criarLoteReembolsos,
  vincularContaPagar,
  downloadComprovantePath,
  listarReembolsosPorLote,
} from "@/lib/reembolsos";
import fs from "fs";
import path from "path";

// ── helpers para criar contas a pagar diretamente ──
const FILE_CP = path.join(process.cwd(), "data", "contas-a-pagar.json");

function lerCP() {
  return JSON.parse(fs.readFileSync(FILE_CP, "utf-8"));
}
function salvarCP(d: unknown) {
  fs.writeFileSync(FILE_CP, JSON.stringify(d, null, 2), "utf-8");
}

function criarContaPagar(dados: {
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
}): string {
  const db = lerCP();
  const id = `cp${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const nova = {
    ...dados,
    id,
    status: "pendente",
    createdAt: new Date().toISOString().split("T")[0],
  };
  db.contas.push(nova);
  salvarCP(db);
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
      const { buscarReembolso } = await import("@/lib/reembolsos");
      const reembolso = buscarReembolso(downloadRebId);
      if (!reembolso || !reembolso.comprovante) {
        return NextResponse.json({ error: "Comprovante não encontrado" }, { status: 404 });
      }
      const filePath = downloadComprovantePath(reembolso.loteId, reembolso.comprovante.caminho);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
      }
      const buffer = fs.readFileSync(filePath);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": reembolso.comprovante.tipo || "application/octet-stream",
          "Content-Disposition": `inline; filename="${reembolso.comprovante.nome}"`,
        },
      });
    }

    const reembolsos = loteId
      ? listarReembolsosPorLote(loteId)
      : listarReembolsos();

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
      const reembolsos = await criarLoteReembolsos(body.itens, loteId);

      // Criar contas a pagar automaticamente
      const contasCriadas: { reembolsoId: string; contaPagarId: string }[] = [];
      for (const reb of reembolsos) {
        const contaPagarId = criarContaPagar({
          dataVencimento: reb.dataFinal,
          fornecedor: `Reembolso — ${reb.motorista}`,
          descricao: `${reb.motivo ? reb.motivo + " — " : ""}${reb.origem} → ${reb.destino} (${reb.distanciaKm} km)`,
          valor: reb.total,
          modalidade: "PIX",
          banco: reb.dadosBancarios.banco || "C6 BANK",
          area: "PROJETOS",
          categoria: "CUSTOS DIRETOS DOS SERVIÇOS",
          dadosBancarios: reb.dadosBancarios,
          reembolsoId: reb.id,
        });
        vincularContaPagar(reb.id, contaPagarId);
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
