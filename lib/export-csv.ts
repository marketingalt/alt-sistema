/**
 * downloadCSV — Gera e faz download de um arquivo CSV (delimitador ;)
 * com encoding UTF-8 + BOM para acentos funcionarem no Excel.
 *
 * @param filename  Nome do arquivo (ex: "fluxo-caixa_06-2026.csv")
 * @param headers   Array de strings para o cabeçalho (ex: ["Data", "Valor"])
 * @param rows      Array de arrays de strings, cada sub-array é uma linha
 */
export function downloadCSV(filename: string, headers: string[], rows: string[][]): void {
  const esc = (v: string) => {
    const s = String(v ?? "");
    // Se contém ; , " ou \n, envelopa em aspas duplas e escapa aspas internas
    if (s.includes(";") || s.includes('"') || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const linhas = [headers.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))];
  // BOM (U+FEFF) + UTF-8
  const bom = "﻿";
  const blob = new Blob([bom + linhas.join("\n")], { type: "text/csv;charset=utf-8;" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
