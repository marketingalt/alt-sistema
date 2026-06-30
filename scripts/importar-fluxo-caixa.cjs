#!/usr/bin/env node
// Import fluxo-caixa CSV data into JSON storage
const fs = require("fs");
const path = require("path");
const CSV_PATH = "/tmp/fluxo-caixa-doc.csv";
const DATA_PATH = "/Users/thiemyrocha/alt-orcamentos/data/fluxo-caixa.json";

function parseBrl(val) {
  if (!val) return 0;
  let s = val.trim();
  const negative = s.startsWith("-");
  if (negative) s = s.slice(1).trim();
  s = s.replace(/^R?\$?\s*/i, "").trim();
  s = s.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  return negative ? -num : num;
}

function parseData(d) {
  if (!d) return null;
  const parts = d.trim().split("/");
  if (parts.length !== 3) return null;
  return `${parts[2].padStart(4, "0")}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

function normalizeModalidade(m) {
  const map = {
    "FATURA CARTAO": "FATURA", FATURA: "FATURA",
    "DÉBITO": "DÉBITO", DEBITO: "DÉBITO",
    INVESTIMENTO: "INVESTIMENTO", PIX: "PIX", TED: "TED",
    BOLETO: "BOLETO", TRANSFERENCIA: "TRANSFERENCIA", TARIFA: "TARIFA",
  };
  const key = (m || "").trim().toUpperCase();
  return map[key] || (m || "").trim() || "PIX";
}

function normalizeArea(a) {
  const area = (a || "").trim().toUpperCase();
  if (area.includes("PROJETO")) return "PROJETOS";
  if (area.includes("DIGITAL")) return "DIGITAL";
  if (area.includes("MISTO")) return "MISTO";
  if (area.includes("ESTORNO")) return "ESTORNO";
  return (a || "").trim() || "MISTO";
}

function normalizeCategoria(c) {
  const cat = (c || "").trim().toUpperCase();
  if (cat.includes("RECEITA OPERACIONAL")) return "RECEITA OPERACIONAL BRUTA";
  if (cat.includes("CUSTOS DIRETOS")) return "CUSTOS DIRETOS DOS SERVIÇOS";
  if (cat.includes("DESPESAS ADM") || cat.includes("ADM E GERAIS")) return "DESPESAS ADM E GERAIS";
  if (cat.includes("PESSOAL OPERACIONAL") && !cat.includes("PROLABORE")) return "DESPESAS COM PESSOAL OPERACIONAL";
  if (cat.includes("PROLABORE")) return "DESPESAS COM PESSOAL — PROLABORE";
  if (cat.includes("DEDUCOES") || cat.includes("DEDUÇÕES") || cat.includes("IMPOSTOS")) return "DEDUÇÕES DA RECEITA (IMPOSTOS)";
  if (cat.includes("COMERCIAIS")) return "DESPESAS COMERCIAIS";
  if (cat.includes("RESULTADO FINANCEIRO")) return "RESULTADO FINANCEIRO";
  if (cat.includes("EMPRÉSTIMO THIEMY") || cat.includes("EMPRESTIMO THIEMY")) return "EMPRÉSTIMO THIEMY";
  if (cat.includes("EMPRÉSTIMO FERNANDO") || cat.includes("EMPRESTIMO FERNANDO")) return "EMPRÉSTIMO FERNANDO";
  if (cat.includes("DEVOLUÇÃO THIEMY") || cat.includes("DEVOLUCAO THIEMY")) return "DEVOLUÇÃO THIEMY";
  if (cat.includes("DEVOLUÇÃO FERNANDO") || cat.includes("DEVOLUCAO FERNANDO")) return "DEVOLUÇÃO FERNANDO";
  if (cat.includes("ESTORNO")) return "ESTORNO";
  return (c || "").trim() || "DESPESAS ADM E GERAIS";
}

function normalizeBanco(b) {
  const banco = (b || "").trim().toUpperCase();
  if (banco.includes("C6")) return "C6 BANK";
  if (banco.includes("ITAU") || banco.includes("ITAÚ")) return "Banco Itaú";
  if (banco.includes("NUBANK") || banco.includes("NU ")) return "NUBANK";
  return (b || "").trim() || "C6 BANK";
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { fields.push(current.trim()); current = ""; }
    else { current += ch; }
  }
  fields.push(current.trim());
  return fields;
}

function isHeader(f) { const first = (f[0] || "").trim().toUpperCase(); return first === "DATA" || first === "DATA "; }
function isEmpty(f) { return f.every((x) => !x || x.trim() === ""); }
function isSaldo(f) { return ((f[3] || "").trim().toUpperCase() === "SALDO"); }

function main() {
  const csv = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = csv.split("\n");

  const lancamentos = [];
  let skippedHeaders = 0, skippedSaldo = 0, skippedEmpty = 0, parsed = 0, errors = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { skippedEmpty++; continue; }
    const fields = parseCsvLine(line);
    if (isHeader(fields)) { skippedHeaders++; continue; }
    if (isEmpty(fields)) { skippedEmpty++; continue; }
    if (isSaldo(fields)) { skippedSaldo++; continue; }

    const data = parseData(fields[0]);
    if (!data) { errors++; continue; }

    const valor = parseBrl(fields[4] || "");
    if (valor === 0) { errors++; continue; }

    let obs = (fields[7] || "").trim();
    const desc = (fields[8] || "").trim();
    if (desc && desc !== obs) obs = obs ? `${obs} — ${desc}` : desc;

    lancamentos.push({
      id: `fc${Date.now()}${parsed}`,
      data,
      modalidade: normalizeModalidade(fields[1]),
      banco: normalizeBanco(fields[2]),
      valor,
      area: normalizeArea(fields[5]),
      categoria: normalizeCategoria(fields[6]),
      obs: obs || "-",
      createdAt: data,
    });
    parsed++;
  }

  lancamentos.sort((a, b) => a.data.localeCompare(b.data));

  // Find initial balance
  let saldoInicial = 0;
  let saldoInicialData = lancamentos[0]?.data || "2025-01-01";
  for (const rawLine of lines) {
    const f = parseCsvLine(rawLine.trim());
    if ((f[3] || "").trim().toUpperCase() === "SALDO" && f[0]?.trim()) {
      const dt = parseData(f[0]);
      if (dt) { saldoInicial = parseBrl(f[4] || "0"); saldoInicialData = dt; break; }
    }
  }

  const dados = { saldoInicial, saldoInicialData, lancamentos };
  fs.writeFileSync(DATA_PATH, JSON.stringify(dados, null, 2));

  const bancos = [...new Set(lancamentos.map(l => l.banco))].sort();
  const areas = [...new Set(lancamentos.map(l => l.area))].sort();
  const cats = [...new Set(lancamentos.map(l => l.categoria))].sort();
  const mods = [...new Set(lancamentos.map(l => l.modalidade))].sort();

  console.log("✅ Importação concluída!");
  console.log(`   Total linhas no CSV:   ${lines.length}`);
  console.log(`   Lançamentos parseados: ${parsed}`);
  console.log(`   Erros:                 ${errors}`);
  console.log(`   Ignorados (headers):   ${skippedHeaders}`);
  console.log(`   Ignorados (SALDO):     ${skippedSaldo}`);
  console.log(`   Ignorados (vazios):    ${skippedEmpty}`);
  console.log(`   Saldo inicial:         ${saldoInicial} (${saldoInicialData})`);
  console.log(`   Período:               ${lancamentos[0]?.data} a ${lancamentos[lancamentos.length - 1]?.data}`);
  console.log(`   Total lançamentos:     ${lancamentos.length}`);
  console.log(`   Bancos:                ${bancos.join(", ")}`);
  console.log(`   Áreas:                 ${areas.join(", ")}`);
  console.log(`   Categorias:            ${cats.join(", ")}`);
  console.log(`   Modalidades:           ${mods.join(", ")}`);
}

main();
