import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";
import { parseBrl } from "@/lib/parseBrl";

interface Lancamento {
  id: string;
  data: string;
  modalidade: string;
  banco: string;
  valor: number;
  area: string;
  categoria: string;
  obs: string;
  createdAt: string;
}

interface FluxoCaixaDB {
  lancamentos: Lancamento[];
  saldoInicial?: number;
  saldoInicialData?: string;
}

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1ZdtBdZEn2P7LaMXMjgnfHdLnPEAmss0--6QMZhgF4Ec/export?format=csv";

/**
 * Convert DD/MM/YYYY or D/M/YYYY to YYYY-MM-DD
 */
function parseDataPtBr(d: string): string | null {
  if (!d) return null;
  const trimmed = d.trim();
  // Remove leading zeros that padStart would add
  const parts = trimmed.split("/");
  if (parts.length !== 3) return null;
  const dia = parts[0].padStart(2, "0");
  const mes = parts[1].padStart(2, "0");
  const ano = parts[2].trim();
  if (ano.length !== 4) return null;
  // Validate
  const dNum = parseInt(dia, 10);
  const mNum = parseInt(mes, 10);
  if (dNum < 1 || dNum > 31 || mNum < 1 || mNum > 12) return null;
  return `${ano}-${mes}-${dia}`;
}

/**
 * Normalize modalidade name
 */
function normalizarModalidade(m: string): string {
  const map: Record<string, string> = {
    "FATURA CARTAO": "FATURA",
    "FATURA": "FATURA",
    "DÉBITO": "DÉBITO",
    "DEBITO": "DÉBITO",
    "DÉBITO AUTOMÁTICO": "DÉBITO",
    "INVESTIMENTO": "INVESTIMENTO",
    "PIX": "PIX",
    "TED": "TED",
    "BOLETO": "BOLETO",
    "TRANSFERENCIA": "TRANSFERENCIA",
    "TRANSFERÊNCIA": "TRANSFERENCIA",
    "TARIFA": "TARIFA",
    "CRÉDITO": "CREDITO",
    "CREDITO": "CREDITO",
    "DOC": "TED",
  };
  const key = m?.trim().toUpperCase() || "";
  return map[key] || m?.trim() || "PIX";
}

/**
 * Normalize area name
 */
function normalizarArea(a: string): string {
  const area = a?.trim().toUpperCase() || "";
  if (area.includes("PROJETO")) return "PROJETOS";
  if (area.includes("DIGITAL")) return "DIGITAL";
  if (area.includes("MISTO")) return "MISTO";
  if (area.includes("ESTORNO")) return "ESTORNO";
  if (area.includes("RECEBIMENTO")) return "RECEBIMENTO";
  return a?.trim() || "MISTO";
}

/**
 * Normalize categoria DRE
 */
function normalizarCategoria(c: string): string {
  const cat = (c || "").trim().toUpperCase();
  if (cat.includes("RECEITA OPERACIONAL")) return "RECEITA OPERACIONAL BRUTA";
  if (cat.includes("CUSTOS DIRETOS")) return "CUSTOS DIRETOS DOS SERVIÇOS";
  if (cat.includes("DESPESAS ADM") || cat.includes("ADM E GERAIS")) return "DESPESAS ADM E GERAIS";
  if (cat.includes("PESSOAL OPERACIONAL") && !cat.includes("PROLABORE")) return "DESPESAS COM PESSOAL OPERACIONAL";
  if (cat.includes("PESSOAL") && cat.includes("PROLABORE")) return "DESPESAS COM PESSOAL — PROLABORE";
  if (cat.includes("PESSOAL")) return "DESPESAS COM PESSOAL OPERACIONAL";
  if (cat.includes("DEDUCOES") || cat.includes("DEDUÇÕES") || cat.includes("DEDU")) return "DEDUÇÕES DA RECEITA (IMPOSTOS)";
  if (cat.includes("COMERCIAIS")) return "DESPESAS COMERCIAIS";
  if (cat.includes("RESULTADO FINANCEIRO")) return "RESULTADO FINANCEIRO";
  if (cat.includes("EMPRÉSTIMO THIEMY") || cat.includes("EMPRESTIMO THIEMY")) return "EMPRÉSTIMO THIEMY";
  if (cat.includes("EMPRÉSTIMO FERNANDO") || cat.includes("EMPRESTIMO FERNANDO")) return "EMPRÉSTIMO FERNANDO";
  if (cat.includes("DEVOLUÇÃO THIEMY") || cat.includes("DEVOLUCAO THIEMY")) return "DEVOLUÇÃO THIEMY";
  if (cat.includes("DEVOLUÇÃO FERNANDO") || cat.includes("DEVOLUCAO FERNANDO")) return "DEVOLUÇÃO FERNANDO";
  if (cat.includes("ESTORNO")) return "ESTORNO";
  // Also strip trailing spaces and normalize basic patterns
  const clean = c?.trim() || "";
  if (!clean) return "DESPESAS ADM E GERAIS";
  return clean;
}

/**
 * Normalize banco name
 */
function normalizarBanco(b: string): string {
  const banco = b?.trim().toUpperCase() || "";
  if (banco.includes("C6")) return "C6 BANK";
  if (banco.includes("ITAU") || banco.includes("ITAÚ")) return "Banco Itaú";
  if (banco.includes("NUBANK") || banco.includes("NU ")) return "NUBANK";
  // Remove trailing whitespace which is common in the CSV
  return b?.trim() || "C6 BANK";
}

/**
 * Simple CSV parser that handles quoted fields
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Check if a row is an empty/marker row (no meaningful data)
 */
function isEmptyRow(fields: string[]): boolean {
  return fields.length === 0 || fields.every((f) => !f || f.trim() === "");
}

/**
 * Check if a row is a SALDO carry-over row
 */
function isSaldoRow(fields: string[]): boolean {
  if (fields.length < 2) return false;
  const gastoRecebimento = (fields[3] || "").trim().toUpperCase();
  if (gastoRecebimento === "SALDO" && fields[0]?.trim()) return true;
  // Also detect if the row has SALDO in any field and no clear date
  const data = (fields[0] || "").trim();
  if (!data && fields.some((f) => (f || "").trim().toUpperCase() === "SALDO")) return true;
  // If the row has SALDO in the first field
  if (data.toUpperCase() === "SALDO") return true;
  return false;
}

/**
 * Check if a row is a header row
 */
function isHeaderRow(fields: string[]): boolean {
  const first = (fields[0] || "").trim().toUpperCase();
  return first === "DATA" || first === "DATA " || first.startsWith("DATA");
}

/**
 * Try to find a VALOR-like field in the row by looking at multiple field indices
 */
function findValorField(fields: string[]): number {
  // VALOR is typically at field[4], but try adjacent fields if that's empty
  const candidates = [4, 3, 5, 6, 2];
  for (const idx of candidates) {
    if (idx >= fields.length) continue;
    const raw = fields[idx] || "";
    if (!raw) continue;
    const val = parseBrl(raw);
    if (!isNaN(val) && val !== 0) return idx;
  }
  return 4; // default
}

export async function POST() {
  try {
    // Fetch CSV
    const response = await fetch(SHEET_URL);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Erro ao baixar planilha: HTTP ${response.status}` },
        { status: 502 }
      );
    }
    const csvText = await response.text();
    const lines = csvText.split("\n");

    const lancamentos: Lancamento[] = [];
    let skippedHeaders = 0;
    let skippedSaldo = 0;
    let skippedEmpty = 0;
    let skippedRef = 0;
    let parsedCount = 0;
    let errorDate = 0;
    let errorValor = 0;
    let errorOther = 0;
    let errorExamples: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        skippedEmpty++;
        continue;
      }

      const fields = parseCsvLine(line);

      // Skip header rows (any line starting with "DATA")
      if (isHeaderRow(fields)) {
        skippedHeaders++;
        continue;
      }

      // Skip empty rows
      if (isEmptyRow(fields)) {
        skippedEmpty++;
        continue;
      }

      // Skip SALDO carry-over rows
      if (isSaldoRow(fields)) {
        skippedSaldo++;
        continue;
      }

      // Skip #REF! rows (broken formulas from Google Sheets)
      if (fields.some((f) => (f || "").includes("#REF!"))) {
        skippedRef++;
        continue;
      }

      // Must have at least 5 fields for DATA + MODALIDADE + BANCO + GASTO/REC + VALOR
      if (fields.length < 4) {
        errorOther++;
        continue;
      }

      // Parse date from field[0]
      const dataRaw = fields[0] || "";
      const data = parseDataPtBr(dataRaw);
      if (!data) {
        if (errorExamples.length < 5) {
          errorExamples.push(`date: ${dataRaw} | fields[0]=${fields[0]} fields[1]=${fields[1]} fields[3]=${fields[3]} fields[4]=${fields[4]}`);
        }
        errorDate++;
        continue;
      }

      // Find the VALOR field - try positions 3, 4, 5 (some sections have shifted columns)
      let valor = 0;
      let valorFieldIdx = -1;
      const valorCandidates = [4, 5, 3, 6, 2]; // Try most likely positions first
      for (const idx of valorCandidates) {
        if (idx >= fields.length) continue;
        const raw = fields[idx]?.trim() || "";
        if (!raw || raw.toUpperCase().includes("SALDO") || raw === "#REF!") continue;
        const v = parseBrl(raw);
        if (!isNaN(v) && v !== 0) {
          valor = v;
          valorFieldIdx = idx;
          break;
        }
      }

      if (valor === 0 || isNaN(valor)) {
        if (errorExamples.length < 5) {
          errorExamples.push(`valor: data=${data} | f4="${fields[4]}" f5="${fields[5]}" f3="${fields[3]}" raw="${fields.join("|")}"`);
        }
        errorValor++;
        continue;
      }

      // Map fields with fallbacks for shifted columns
      const modalidade = normalizarModalidade(fields[1]?.trim() || "");

      // BANCO could be at field[2]
      const banco = normalizarBanco(fields[2]?.trim() || "");

      // AREA typically at field[5], but might shift
      const areaRaw = fields[5]?.trim() || "";
      const area = normalizarArea(areaRaw);

      // CATEGORIA typically at field[6], but might shift
      const catRaw = fields[6]?.trim() || "";
      const categoria = normalizarCategoria(catRaw);

      // OBS at field[7], DESCRICAO at field[8] (if available and not a column label)
      let obs = fields[7]?.trim() || "";
      const desc = fields[8]?.trim() || "";
      if (desc && desc !== "Column 10" && desc.toUpperCase() !== "SALDO" && desc !== obs) {
        obs = obs ? `${obs} — ${desc}` : desc;
      }
      // Also check field[9] if it looks like text (not a number or "SALDO")
      const f9 = fields[9]?.trim() || "";
      if (f9 && !/^-?\d/.test(f9) && f9.toUpperCase() !== "SALDO" && f9 !== "Column 11" && f9 !== obs) {
        obs = obs ? `${obs} — ${f9}` : f9;
      }

      const lancamento: Lancamento = {
        id: `fc${Date.now()}${parsedCount}`,
        data,
        modalidade,
        banco,
        valor,
        area,
        categoria,
        obs: obs || "-",
        createdAt: data,
      };

      lancamentos.push(lancamento);
      parsedCount++;
    }

    // Sort by date ascending
    lancamentos.sort((a, b) => a.data.localeCompare(b.data));

    // Find saldoInicial from the first SALDO row in the CSV
    let saldoInicial = 0;
    let saldoInicialData = lancamentos[0]?.data || "2025-01-01";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const f = parseCsvLine(line);
      if (f.length >= 5 && (f[3] || "").trim().toUpperCase() === "SALDO" && f[0]?.trim()) {
        const dt = parseDataPtBr(f[0]);
        if (dt) {
          saldoInicial = parseBrl(f[4] || "0");
          saldoInicialData = dt;
          break;
        }
      }
    }

    // Find unique bancos, modalidades, areas for logging
    const bancosUnicos = [...new Set(lancamentos.map((l) => l.banco))].sort();
    const areasUnicas = [...new Set(lancamentos.map((l) => l.area))].sort();
    const catsUnicas = [...new Set(lancamentos.map((l) => l.categoria))].sort();
    const modUnicas = [...new Set(lancamentos.map((l) => l.modalidade))].sort();

    // Group by month for detailed reporting
    const monthCounts: Record<string, number> = {};
    for (const l of lancamentos) {
      const m = l.data.substring(0, 7);
      monthCounts[m] = (monthCounts[m] || 0) + 1;
    }
    const monthsSorted = Object.entries(monthCounts).sort((a, b) => a[0].localeCompare(b[0]));

    // Save to storage
    const dados: FluxoCaixaDB = {
      saldoInicial,
      saldoInicialData,
      lancamentos,
    };

    await dbSet("fluxo-caixa", dados);

    return NextResponse.json({
      success: true,
      resumo: {
        totalLinhas: lines.length,
        parseados: parsedCount,
        errosData: errorDate,
        errosValor: errorValor,
        errosOutros: errorOther,
        ignoradosCabecalho: skippedHeaders,
        ignoradosSaldo: skippedSaldo,
        ignoradosVazios: skippedEmpty,
        ignoradosRef: skippedRef,
        saldoInicial,
        saldoInicialData,
        bancos: bancosUnicos,
        modalidades: modUnicas,
        areas: areasUnicas,
        categorias: catsUnicas,
        periodo: {
          inicio: lancamentos[0]?.data,
          fim: lancamentos[lancamentos.length - 1]?.data,
        },
        porMes: monthsSorted.map(([m, c]) => `${m}: ${c}`),
        exemplosErro: errorExamples,
      },
    });
  } catch (err) {
    console.error("[IMPORTAR PLANILHA]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
