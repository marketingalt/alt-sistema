/**
 * Parse a Brazilian currency value like "R$ 1.234,56" or "-R$ 100,00"
 * or "R$ 1.234.567,89" to a JS number.
 */
export function parseBrl(val: string): number {
  if (!val) return 0;
  let s = val.trim();
  const negative = s.startsWith("-");
  if (negative) s = s.slice(1).trim();
  // Now remove R$ prefix (it's safe because we already handled the negative sign)
  s = s.replace(/^R?\$?\s*/i, "").trim();
  s = s.replace(/\./g, "");
  s = s.replace(",", ".");
  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  return Math.round((negative ? -num : num) * 100) / 100;
}
