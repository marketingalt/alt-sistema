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

interface LinhaPreview {
  linha: number;
  data: string;
  fornecedor: string;
  descricao: string;
  valor: number;
  parcela: string;
  categoriaCartao: string;
  erro?: string;
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
    // Remove BOM (Byte Order Mark) se presente
    const textoSemBOM = texto.replace(/^﻿/, "");
    // Converte tabs pra ; — o export do C6 Bank é tab-delimitado
    const textoComDelim = textoSemBOM.replace(/\t/g, ";");
    // Remove linhas de info antes do cabeçalho (ex: "Razão Social: ...").
    // A linha do cabeçalho tem colunas com nomes reconhecíveis.
    const linhas = textoComDelim.split("\n");
    const headerIdx = linhas.findIndex(
      (l) =>
        !l.match(/^razao/i) &&
        l.split(";").filter((c) => c.trim().length > 0).length >= 5
    );
    if (headerIdx === -1) {
      return NextResponse.json({ error: "CSV sem formato de colunas reconhecido." }, { status: 400 });
    }
    const textoLimpo = linhas.slice(headerIdx).join("\n");
    const linhasRaw = parseCSV(textoLimpo);

    if (linhasRaw.length === 0) {
      return NextResponse.json({ error: "CSV vazio ou sem dados." }, { status: 400 });
    }

    // Mapeia colunas por nome normalizado
    // O parseCSV já normaliza as chaves: lowercase, sem acentos,
    // caracteres não alfanuméricos viram underscore.
    // Ex: "Valor (em R$)" → "valor_em_r"
    const cabecalho = linhasRaw[0];
    const colunas = Object.keys(cabecalho);
    const chk = (nome: string) => colunas.find((k) => k === nome);

    const colData = chk("data_de_compra") ?? chk("data");
    const colDescricao = chk("descricao");
    const colNome = chk("nome_no_cartao");
    const colFinal = chk("final_do_cartao");
    const colCat = chk("categoria");
    const colParcela = chk("parcela");
    const colValorRS = chk("valor_em_r") ?? chk("valor");
    const colValorUS = chk("valor_em_us");
    const colCotacao = chk("cotacao_em_r");
    const colRazao = chk("razao_social");

    if (!colData || !colDescricao || !colValorRS) {
      return NextResponse.json({
        error: "Formato de CSV não reconhecido. Colunas esperadas: Data de compra, Descrição, Valor (em R$).",
      }, { status: 400 });
    }

    // Pula primeiro header row, processa as demais
    // A primeira linha pode ser uma linha de info (Razão Social...), pula se tiver Razão Social
    const linhasDados = linhasRaw.slice(1).filter((row) => {
      const v = row[colData]?.trim();
      return v && v.length > 0;
    });

    const processadas: LinhaPreview[] = [];
    const ignorados: string[] = [];

    for (const row of linhasDados) {
      const dataRaw = (row[colData] || "").trim();
      const descricaoRaw = (row[colDescricao] || "").trim();

      // Pula linhas de info (Razão Social)
      if (dataRaw.toLowerCase().startsWith("razão") || dataRaw.toLowerCase().startsWith("razao")) {
        continue;
      }

      // Pula linhas sem data válida
      const partesData = dataRaw.split("/");
      if (partesData.length !== 3) continue;

      // Verifica se é linha de info sobre cartão
      const nomeRaw = colNome ? (row[colNome] || "").trim() : "";
      const finalRaw = colFinal ? (row[colFinal] || "").trim() : "";
      const catCartaoRaw = colCat ? (row[colCat] || "").trim() : "";
      const parcelaRaw = colParcela ? (row[colParcela] || "").trim() : "";
      const valorRaw = (row[colValorRS] || "").trim();

      // Parse valor: "R$ 89,88" or "R$ - 3.228,92"
      const valorStr = valorRaw
        .replace("R$", "")
        .replace(/\./g, "")
        .replace(",", ".")
        .replace(/\s+/g, "")
        .trim();

      let valor = parseFloat(valorStr);
      // Paga valores zerados
      if (isNaN(valor) || valor === 0) continue;

      // Skip negative values (payments/credits toward the card)
      if (valor < 0) {
        ignorados.push(`Linha ${linhasDados.indexOf(row) + 2}: Valor negativo (R$ ${Math.abs(valor).toFixed(2)}) — ${descricaoRaw}`);
        continue;
      }

      const dataFormatada = `${partesData[2]}-${partesData[1].padStart(2, "0")}-${partesData[0].padStart(2, "0")}`;

      // Monta obs com info do cartão + parcela
      const partesObs: string[] = [];
      if (catCartaoRaw && catCartaoRaw !== "-") partesObs.push(catCartaoRaw);
      if (parcelaRaw && parcelaRaw !== "Única" && parcelaRaw !== "Unica") partesObs.push(`Parcela ${parcelaRaw}`);
      if (finalRaw) partesObs.push(`Final ${finalRaw}`);

      processadas.push({
        linha: linhasDados.indexOf(row) + 2,
        data: dataFormatada,
        fornecedor: descricaoRaw,
        descricao: `Fatura C6: ${descricaoRaw}`,
        valor,
        parcela: parcelaRaw || "Única",
        categoriaCartao: catCartaoRaw || "-",
      });
    }

    if (!confirmar) {
      return NextResponse.json({
        total: processadas.length,
        validas: processadas.length,
        erros: 0,
        ignorados: ignorados.length,
        ignoradosLista: ignorados.slice(0, 20),
        linhas: processadas.slice(0, 50),
        haMais: processadas.length > 50,
      });
    }

    if (processadas.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha válida para importar." }, { status: 400 });
    }

    // Importar de fato
    const base = await lerBase();
    const criadas: Record<string, unknown>[] = [];

    for (const p of processadas) {
      const obsParts: string[] = [];
      if (p.parcela && p.parcela !== "Única") obsParts.push(`Parcela ${p.parcela}`);
      if (p.categoriaCartao && p.categoriaCartao !== "-") obsParts.push(`Cat: ${p.categoriaCartao}`);

      const nova: Record<string, unknown> = {
        id: `cp${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dataVencimento: p.data,
        fornecedor: p.fornecedor,
        descricao: `Fatura C6: ${p.fornecedor}`,
        valor: p.valor,
        modalidade: "CRÉDITO",
        banco: "C6 BANK",
        area: "MISTO",
        categoria: "DESPESAS ADM E GERAIS",
        obs: obsParts.length > 0 ? obsParts.join(" | ") : undefined,
        status: "pendente",
        createdAt: new Date().toISOString().split("T")[0],
      };
      base.contas.push(nova);
      criadas.push(nova);
    }

    await salvarBase(base);

    return NextResponse.json({
      importadas: criadas.length,
      erros: ignorados.length,
      detalhes: ignorados.length > 0
        ? ignorados.slice(0, 20).map((e) => e)
        : undefined,
    });
  } catch (err) {
    console.error("Erro ao importar fatura C6:", err);
    return NextResponse.json({ error: "Erro interno ao processar o arquivo." }, { status: 500 });
  }
}
