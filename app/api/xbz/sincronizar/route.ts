import { NextResponse } from "next/server";
import { listarProdutos, sincronizarProdutosBulk } from "@/lib/storage";
import { lerUltimaSync, salvarUltimaSync } from "@/lib/syncLog";
import type { Produto } from "@/app/types";

interface ProdutoXbz {
  IdProduto: number;
  CodigoXbz: string;
  CodigoAmigavel: string;
  CodigoComposto: string;
  Nome: string;
  Descricao: string;
  ImageLink: string;
  CorWebPrincipal: string;
  PrecoVenda: number;
  QuantidadeDisponivel: number;
  PontaDeEstoque: boolean;
  StatusConfiabilidade: string;
  Peso: number;
  Altura: number;
  Largura: number;
  Profundidade: number;
}

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

function montarInfoTecnica(p: ProdutoXbz): string {
  const partes: string[] = [];
  if (p.Descricao) partes.push(p.Descricao);
  const dims: string[] = [];
  if (p.Peso) dims.push(`Peso: ${p.Peso}g`);
  if (p.Altura) dims.push(`Altura: ${p.Altura}cm`);
  if (p.Largura) dims.push(`Largura: ${p.Largura}cm`);
  if (p.Profundidade) dims.push(`Profundidade: ${p.Profundidade}cm`);
  if (dims.length) partes.push(dims.join(" · "));
  return partes.join("\n");
}

async function executarSync() {
  const cnpj = process.env.XBZ_CNPJ;
  const token = process.env.XBZ_TOKEN;

  if (!cnpj || !token) throw new Error("Credenciais XBZ não configuradas.");

  const res = await fetch(
    `https://api.minhaxbz.com.br:5001/api/clientes/GetListaDeProdutos?cnpj=${cnpj}&token=${token}`,
    { cache: "no-store" }
  );

  if (res.status === 401) throw new Error("Token ou CNPJ inválidos.");
  if (res.status === 403) throw new Error("Limite diário de acessos atingido.");
  if (!res.ok) throw new Error(`Erro na API XBZ: ${res.status}`);

  const produtosXbz: ProdutoXbz[] = await res.json();
  const existentes = await listarProdutos();
  const porXbzId = new Map(existentes.filter((p) => p.xbzId).map((p) => [p.xbzId!, p]));

  const novos: Produto[] = [];
  const atualizacoes: { id: string; campos: Partial<Produto> }[] = [];

  for (const xbz of produtosXbz) {
    const xbzId = String(xbz.IdProduto);
    const existing = porXbzId.get(xbzId);

    if (existing) {
      atualizacoes.push({
        id: existing.id,
        campos: {
          precoCusto: xbz.PrecoVenda,
          estoque: xbz.QuantidadeDisponivel,
          imagemUrl: xbz.ImageLink?.trim() || existing.imagemUrl,
          cor: xbz.CorWebPrincipal || existing.cor,
        },
      });
    } else {
      novos.push({
        id: gerarId(),
        sku: xbz.CodigoAmigavel,
        nome: xbz.Nome,
        marca: "XBZ Brindes",
        precoCusto: xbz.PrecoVenda,
        fornecedorId: "xbz",
        fornecedorNome: "XBZ Brindes",
        imagemUrl: xbz.ImageLink?.trim() || undefined,
        informacaoTecnica: montarInfoTecnica(xbz),
        jaPersonalizado: false,
        cor: xbz.CorWebPrincipal || undefined,
        estoque: xbz.QuantidadeDisponivel,
        xbzId,
        origemXbz: true,
        status: "Ativo",
        createdAt: new Date().toISOString(),
      });
    }
  }

  await sincronizarProdutosBulk(novos, atualizacoes);
  salvarUltimaSync();

  return { criados: novos.length, atualizados: atualizacoes.length, total: produtosXbz.length };
}

// Chamada manual pelo botão
export async function POST() {
  try {
    const resultado = await executarSync();
    return NextResponse.json(resultado);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

// Chamada automática — só executa se passou mais de 1 hora
export async function GET() {
  const log = lerUltimaSync();
  const agora = Date.now();
  const UMA_HORA = 60 * 60 * 1000;

  if (log.ultimaSync && agora - new Date(log.ultimaSync).getTime() < UMA_HORA) {
    return NextResponse.json({ sincronizado: false, ultimaSync: log.ultimaSync });
  }

  try {
    const resultado = await executarSync();
    return NextResponse.json({ sincronizado: true, ultimaSync: new Date().toISOString(), ...resultado });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro.";
    return NextResponse.json({ sincronizado: false, error: msg }, { status: 502 });
  }
}
