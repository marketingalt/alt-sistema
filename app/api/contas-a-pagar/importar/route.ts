import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import { parseCSV } from "@/lib/csv-utils";

interface ContasPagarDB {
  contas: any[];
}

async function lerBase(): Promise<ContasPagarDB> {
  return dbGet<ContasPagarDB>("contas-a-pagar", { contas: [] });
}
async function salvarBase(d: ContasPagarDB) {
  await dbSet("contas-a-pagar", d);
}

// ── Mapeamento de colunas (normalizadas) ──
const MAPA_COLUNAS: Record<string, string> = {
  vencimento: "dataVencimento",
  data_vencimento: "dataVencimento",
  data: "dataVencimento",
  fornecedor: "fornecedor",
  beneficiario: "fornecedor",
  descricao: "descricao",
  descrição: "descricao",
  valor: "valor",
  modalidade: "modalidade",
  forma_pagamento: "modalidade",
  banco: "banco",
  area: "area",
  área: "area",
  categoria: "categoria",
  dre: "categoria",
  obs: "obs",
  observacao: "obs",
  observação: "obs",
  recorrente: "recorrente",
  periodicidade: "periodicidade",
};

const MODALIDADES_VALIDAS = ["PIX", "TED", "DÉBITO", "BOLETO", "FATURA", "INVESTIMENTO", "TRANSFERENCIA"];
const AREAS_VALIDAS = ["PROJETOS", "DIGITAL", "MISTO", "ESTORNO"];
const CATEGORIAS_VALIDAS = [
  "RECEITA OPERACIONAL BRUTA",
  "CUSTOS DIRETOS DOS SERVIÇOS",
  "DESPESAS ADM E GERAIS",
  "DESPESAS COM PESSOAL OPERACIONAL",
  "DESPESAS COM PESSOAL — PROLABORE",
  "DEDUÇÕES DA RECEITA (IMPOSTOS)",
  "DESPESAS COMERCIAIS",
  "RESULTADO FINANCEIRO",
  "EMPRÉSTIMO THIEMY",
  "EMPRÉSTIMO FERNANDO",
  "DEVOLUÇÃO THIEMY",
  "DEVOLUÇÃO FERNANDO",
  "ESTORNO",
];

function normalizar(valor: string): string {
  return valor
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function encontrarColuna(linha: Record<string, string>, campo: string): string | undefined {
  for (const [chaveNormalizada, destino] of Object.entries(MAPA_COLUNAS)) {
    if (destino === campo && linha[chaveNormalizada] !== undefined) {
      return linha[chaveNormalizada];
    }
  }
  return undefined;
}

interface LinhaImportada {
  linha: number;
  dados: Record<string, string>;
  erros: string[];
  mapeado: Record<string, string> | null;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const formData = await req.formData();
    const arquivo = formData.get("arquivo") as File | null;
    const confirmar = formData.get("confirmar") === "true";

    if (!arquivo) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }

    const texto = await arquivo.text();
    const linhasRaw = parseCSV(texto);

    if (linhasRaw.length === 0) {
      return NextResponse.json({ error: "CSV vazio ou sem dados. Verifique se o arquivo tem cabeçalho e ao menos uma linha de dados." }, { status: 400 });
    }

    const processadas: LinhaImportada[] = linhasRaw.map((linha, idx) => {
      const erros: string[] = [];
      const numeroLinha = idx + 2;

      const vencimento = encontrarColuna(linha, "dataVencimento");
      const fornecedor = encontrarColuna(linha, "fornecedor");
      const descricao = encontrarColuna(linha, "descricao");
      const valorRaw = encontrarColuna(linha, "valor");

      if (!vencimento) erros.push("Vencimento não encontrado");
      if (!fornecedor) erros.push("Fornecedor não encontrado");
      if (!descricao) erros.push("Descrição não encontrada");
      if (!valorRaw) erros.push("Valor não encontrado");

      let valor = 0;
      if (valorRaw) {
        valor = parseFloat(valorRaw.replace(/\./g, "").replace(",", "."));
        if (isNaN(valor) || valor < 0) {
          erros.push(`Valor inválido: "${valorRaw}"`);
          valor = 0;
        }
      }

      if (erros.length > 0) {
        return { linha: numeroLinha, dados: linha, erros, mapeado: null };
      }

      const modalidadeRaw = encontrarColuna(linha, "modalidade") || "PIX";
      const bancoRaw = encontrarColuna(linha, "banco") || "C6 BANK";
      const areaRaw = encontrarColuna(linha, "area") || "MISTO";
      const categoriaRaw = encontrarColuna(linha, "categoria") || "DESPESAS ADM E GERAIS";
      const obs = encontrarColuna(linha, "obs") || "";
      const recorrenteRaw = encontrarColuna(linha, "recorrente") || "";
      const periodicidade = encontrarColuna(linha, "periodicidade") || "mensal";

      const modalidade = normalizar(modalidadeRaw);
      const banco = normalizar(bancoRaw);
      const area = normalizar(areaRaw);
      const categoria = normalizar(categoriaRaw);

      if (!MODALIDADES_VALIDAS.some((m) => normalizar(m) === modalidade)) {
        erros.push(`Modalidade inválida: "${modalidadeRaw}". Use: PIX, TED, DÉBITO, BOLETO, FATURA, INVESTIMENTO ou TRANSFERENCIA`);
      }
      if (!AREAS_VALIDAS.some((a) => normalizar(a) === area)) {
        erros.push(`Área inválida: "${areaRaw}". Use: PROJETOS, DIGITAL, MISTO ou ESTORNO`);
      }
      if (!CATEGORIAS_VALIDAS.some((c) => normalizar(c) === categoria)) {
        erros.push(`Categoria inválida: "${categoriaRaw}". Verifique a lista de categorias DRE.`);
      }

      if (erros.length > 0) {
        return { linha: numeroLinha, dados: linha, erros, mapeado: null };
      }

      const recorrenteVal = ["sim", "true", "1", "s", "yes"].includes(recorrenteRaw.toLowerCase().trim());

      const mapeado: Record<string, string> = {
        dataVencimento: vencimento!,
        fornecedor: fornecedor!.trim(),
        descricao: descricao!.trim(),
        valor: String(valor),
        modalidade: MODALIDADES_VALIDAS.find((m) => normalizar(m) === modalidade)!,
        banco: bancoRaw.trim(),
        area: AREAS_VALIDAS.find((a) => normalizar(a) === area)!,
        categoria: CATEGORIAS_VALIDAS.find((c) => normalizar(c) === categoria)!,
        obs: obs.trim(),
        recorrente: String(recorrenteVal),
        periodicidade: recorrenteVal ? periodicidade.toLowerCase().trim() : "",
      };

      return { linha: numeroLinha, dados: linha, erros, mapeado };
    });

    const validas = processadas.filter((p) => p.erros.length === 0 && p.mapeado);
    const comErro = processadas.filter((p) => p.erros.length > 0);

    if (!confirmar) {
      return NextResponse.json({
        total: processadas.length,
        validas: validas.length,
        erros: comErro.length,
        linhas: processadas.slice(0, 50).map((p) => ({
          linha: p.linha,
          erros: p.erros,
          mapeado: p.mapeado,
        })),
        totalExibido: Math.min(50, processadas.length),
        haMais: processadas.length > 50,
      });
    }

    if (validas.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha válida para importar." }, { status: 400 });
    }

    const base = await lerBase();
    const criadas: Record<string, unknown>[] = [];

    for (const v of validas) {
      if (!v.mapeado) continue;
      const m = v.mapeado;
      const nova: Record<string, unknown> = {
        id: `cp${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dataVencimento: m.dataVencimento,
        fornecedor: m.fornecedor,
        descricao: m.descricao,
        valor: parseFloat(m.valor),
        modalidade: m.modalidade,
        banco: m.banco,
        area: m.area,
        categoria: m.categoria,
        obs: m.obs || undefined,
        status: "pendente",
        recorrente: m.recorrente === "true" || m.recorrente === "sim",
        periodicidade: m.recorrente === "true" || m.recorrente === "sim" ? (m.periodicidade || "mensal") : undefined,
        createdAt: new Date().toISOString().split("T")[0],
      };
      base.contas.push(nova);
      criadas.push(nova);
    }

    await salvarBase(base);

    return NextResponse.json({
      importadas: criadas.length,
      erros: comErro.length,
      detalhes: comErro.length > 0
        ? comErro.slice(0, 20).map((e) => `Linha ${e.linha}: ${e.erros.join("; ")}`)
        : undefined,
    });
  } catch (err) {
    console.error("Erro ao importar CSV:", err);
    return NextResponse.json({ error: "Erro interno ao processar o arquivo." }, { status: 500 });
  }
}
