/**
 * Script de importação do fluxo de caixa a partir do CSV do Google Sheets.
 * Uso: npx tsx scripts/importar-fluxo-caixa.ts
 */

import * as fs from "fs";
import * as path from "path";

const CSV_PATH = "/tmp/fluxo-caixa-doc.csv";
const DATA_PATH = path.join(process.cwd(), "data", "fluxo-caixa.json");

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
  saldoInicial: number;
  saldoInicialData: string;
  lancamentos: Lancamento[];
}

function parseBrl(val: string): number {
  if (!val) return 0;
  let s = val.replace(/^R?\$?\s*/i, "").trim();
  const negative = s.startsWith("-");
  if (negative) s = s.slice(1).trim();
  s = s.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(s);
  return negative ? -num : num;
}

function parseDataPtBr(d: string): string | null {
  if (!d) return null;
  const parts = d.trim().split("/");
  if (parts.length !== 3) return null;
  const dia = parts[0].padStart(2, "0");
  const mes = parts[1].padStart(2, "0");
  const ano = parts[2];
  if (ano.length !== 4) return null;
  return `${ano}-${mes}-${dia}`;
}

function normalizarModalidade(m: string): string {
  const map: Record<string, string> = {
    "FATURA CARTAO": "FATURA",
    FATURA: "FATURA",
    DÉBITO: "DÉBITO",
    DEBITO: "DÉBITO",
    INVESTIMENTO: "INVESTIMENTO",
    PIX: "PIX",
    TED: "TED",
    BOLETO: "BOLETO",
    TRANSFERENCIA: "TRANSFERENCIA",
    TARIFA: "TARIFA",
  };
  const key = m?.trim().toUpperCase() || "";
  return map[key] || m?.trim() || "PIX";
}

function normalizarArea(a: string): string {
  const area = a?.trim().toUpperCase() || "";
  if (area.includes("PROJETO")) return "PROJETOS";
  if (area.includes("DIGITAL")) return "DIGITAL";
  if (area.includes("MISTO")) return "MISTO";
  if (area.includes("ESTORNO")) return "ESTORNO";
  return a?.trim() || "MISTO";
}

function normalizarCategoria(c: string): string {
  const cat = c?.trim().toUpperCase() || "";
  if (cat.includes("RECEITA OPERACIONAL BRUTA") || cat.includes("RECEITA OPERACIONAL"))
    return "RECEITA OPERACIONAL BRUTA";
  if (cat.includes("CUSTOS DIRETOS")) return "CUSTOS DIRETOS DOS SERVIÇOS";
  if (cat.includes("DESPESAS ADM") || cat.includes("ADM E GERAIS"))
    return "DESPESAS ADM E GERAIS";
  if (cat.includes("PESSOAL OPERACIONAL") && !cat.includes("PROLABORE"))
    return "DESPESAS COM PESSOAL OPERACIONAL";
  if (cat.includes("PESSOAL") && cat.includes("PROLABORE"))
    return "DESPESAS COM PESSOAL — PROLABORE";
  if (cat.includes("DEDUCOES") || cat.includes("DEDUÇÕES") || cat.includes("IMPOSTOS"))
    return "DEDUÇÕES DA RECEITA (IMPOSTOS)";
  if (cat.includes("COMERCIAIS")) return "DESPESAS COMERCIAIS";
  if (cat.includes("RESULTADO FINANCEIRO")) return "RESULTADO FINANCEIRO";
  if (cat.includes("EMPRÉSTIMO THIEMY") || cat.includes("EMPRESTIMO THIEMY"))
    return "EMPRÉSTIMO THIEMY";
  if (cat.includes("EMPRÉSTIMO FERNANDO") || cat.includes("EMPRESTIMO FERNANDO"))
    return "EMPRÉSTIMO FERNANDO";
  if (cat.includes("DEVOLUÇÃO THIEMY") || cat.includes("DEVOLUCAO THIEMY"))
    return "DEVOLUÇÃO THIEMY";
  if (cat.includes("DEVOLUÇÃO FERNANDO") || cat.includes("DEVOLUCAO FERNANDO"))
    return "DEVOLUÇÃO FERNANDO";
  if (cat.includes("ESTORNO")) return "ESTORNO";
  return c?.trim() || "DESPESAS ADM E GERAIS";
}

function normalizarBanco(b: string): string {
  const banco = b?.trim().toUpperCase() || "";
  if (banco.includes("C6")) return "C6 BANK";
  if (banco.includes("ITAU") || banco.includes("ITAÚ")) return "Banco Itaú";
  if (banco.includes("NUBANK") || banco.includes("NU ")) return "NUBANK";
  return b?.trim() || "C6 BANK";
}

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

function isHeaderRow(fields: string[]): boolean {
  const first = (fields[0] || "").trim().toUpperCase();
  return first === "DATA" || first === "DATA ";
}

function isEmptyRow(fields: string[]): boolean {
  return fields.every((f) => !f || f.trim() === "" || f.trim() === ",");
}

function isSaldoRow(fields: string[]): boolean {
  const gastoRec = (fields[3] || "").trim().toUpperCase();
  return gastoRec === "SALDO";
}

function main() {
  const csv = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = csv.split("\n");

  const lancamentos: Lancamento[] = [];
  let skippedHeaders = 0;
  let skippedSaldo = 0;
  let skippedEmpty = 0;
  let parsedCount = 0;
  let errorCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      skippedEmpty++;
      continue;
    }

    const fields = parseCsvLine(line);

    if (isHeaderRow(fields)) {
      skippedHeaders++;
      continue;
    }

    if (isEmptyRow(fields)) {
      skippedEmpty++;
      continue;
    }

    if (isSaldoRow(fields)) {
      skippedSaldo++;
      continue;
    }

    const dataRaw = fields[0] || "";
    const modalidadeRaw = fields[1] || "";
    const bancoRaw = fields[2] || "";
    const valorRaw = fields[4] || "";
    const areaRaw = fields[5] || "";
    const categoriaRaw = fields[6] || "";
    const obsRaw = fields[7] || "";
    const descricaoRaw = fields[8] || "";

    const data = parseDataPtBr(dataRaw);
    if (!data) {
      errorCount++;
      continue;
    }

    const valor = parseBrl(valorRaw);
    if (isNaN(valor) || valor === 0) {
      errorCount++;
      continue;
    }

    let obs = obsRaw?.trim() || "";
    const desc = descricaoRaw?.trim() || "";
    if (desc && desc !== obs) {
      obs = obs ? `${obs} — ${desc}` : desc;
    }

    const lancamento: Lancamento = {
      id: `fc${Date.now()}${parsedCount}`,
      data,
      modalidade: normalizarModalidade(modalidadeRaw),
      banco: normalizarBanco(bancoRaw),
      valor,
      area: normalizarArea(areaRaw),
      categoria: normalizarCategoria(categoriaRaw),
      obs: obs || "-",
      createdAt: data,
    };

    lancamentos.push(lancamento);
    parsedCount++;
  }

  lancamentos.sort((a, b) => a.data.localeCompare(b.data));

  // Encontrar saldo inicial do primeiro SALDO do CSV
  let saldoInicial = 0;
  let saldoInicialData = lancamentos[0]?.data || "2025-01-01";
  for (const rawLine of lines) {
    const fields = parseCsvLine(rawLine.trim());
    if (fields.length < 5) continue;
    const gastoRec = (fields[3] || "").trim().toUpperCase();
    if (gastoRec === "SALDO" && fields[0]?.trim()) {
      const dt = parseDataPtBr(fields[0]);
      if (dt) {
        saldoInicial = parseBrl(fields[4] || "");
        saldoInicialData = dt;
        break;
      }
    }
  }

  const dados: FluxoCaixaDB = { saldoInicial, saldoInicialData, lancamentos };

  // Salvar
  fs.writeFileSync(DATA_PATH, JSON.stringify(dados, null, 2));
  console.log("✅ Importação concluída!");
  console.log(`   Total linhas no CSV:   ${lines.length}`);
  console.log(`   Lançamentos parseados: ${parsedCount}`);
  console.log(`   Erros:                 ${errorCount}`);
  console.log(`   Ignorados (headers):   ${skippedHeaders}`);
  console.log(`   Ignorados (SALDO):     ${skippedSaldo}`);
  console.log(`   Ignorados (vazios):    ${skippedEmpty}`);
  console.log(`   Saldo inicial:         ${saldoInicial} (${saldoInicialData})`);
  console.log(`   Período:               ${lancamentos[0]?.data} a ${lancamentos[lancamentos.length - 1]?.data}`);
  console.log(`   Bancos:                ${[...new Set(lancamentos.map(l => l.banco))].sort().join(", ")}`);
  console.log(`   Áreas:                 ${[...new Set(lancamentos.map(l => l.area))].sort().join(", ")}`);
  console.log(`   Categorias:            ${[...new Set(lancamentos.map(l => l.categoria))].sort().join(", ")}`);
  console.log(`   Modalidades:           ${[...new Set(lancamentos.map(l => l.modalidade))].sort().join(", ")}`);
}

main();
