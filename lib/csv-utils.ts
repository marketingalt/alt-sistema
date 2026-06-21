/**
 * Parser CSV simples — lida com delimitador `;` ou `,`, campos entre aspas,
 * e quebras de linha dentro de campos.
 *
 * Retorna um array de objetos com as chaves normalizadas (lowercase, sem
 * acentos, espaços viram underscore).
 */

export function parseCSV(texto: string): Record<string, string>[] {
  const linhas = extrairLinhas(texto);
  if (linhas.length < 2) return [];

  const cabecalhos = parseLinha(linhas[0]).map(normalizarChave);
  const resultados: Record<string, string>[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    const valores = parseLinha(linha);
    const obj: Record<string, string> = {};
    cabecalhos.forEach((chave, idx) => {
      obj[chave] = (valores[idx] ?? "").trim();
    });
    resultados.push(obj);
  }

  return resultados;
}

function extrairLinhas(texto: string): string[] {
  const linhas: string[] = [];
  let atual = "";
  let dentroAspas = false;

  for (const char of texto) {
    if (char === '"') {
      dentroAspas = !dentroAspas;
      atual += char;
    } else if (char === "\n" && !dentroAspas) {
      linhas.push(atual);
      atual = "";
    } else if (char === "\r" && !dentroAspas) {
      // ignora carriage return
    } else {
      atual += char;
    }
  }
  if (atual.trim()) linhas.push(atual);
  return linhas;
}

function parseLinha(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroAspas = false;

  for (const char of linha) {
    if (char === '"') {
      dentroAspas = !dentroAspas;
      atual += char;
    } else if ((char === ";" || char === ",") && !dentroAspas) {
      campos.push(atual);
      atual = "";
    } else {
      atual += char;
    }
  }
  campos.push(atual);
  return campos.map(limparAspas);
}

function limparAspas(valor: string): string {
  valor = valor.trim();
  if (valor.startsWith('"') && valor.endsWith('"')) {
    valor = valor.slice(1, -1);
  }
  return valor.replace(/""/g, '"');
}

function normalizarChave(chave: string): string {
  return chave
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
