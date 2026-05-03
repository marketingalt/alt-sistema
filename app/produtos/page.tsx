"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import type { Produto } from "@/app/types";

function badgeEstoque(estoque: number) {
  if (estoque <= 0) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Sem estoque</span>;
  if (estoque < 50) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{estoque} un.</span>;
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{estoque} un.</span>;
}

const FILTROS_VAZIOS = { texto: "", quantidade: "", precoMin: "", precoMax: "", cor: "", origem: "todos" as "todos" | "xbz" | "manual" };

export default function ListaProdutos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [resultadoSync, setResultadoSync] = useState<{ criados: number; atualizados: number } | null>(null);
  const [erroSync, setErroSync] = useState<string | null>(null);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [buscaAtiva, setBuscaAtiva] = useState(false);

  function carregar() {
    setCarregando(true);
    fetch("/api/produtos").then((r) => r.json()).then((d) => { setProdutos(d); setCarregando(false); });
  }

  useEffect(() => {
    carregar();
    // Sync automática ao abrir — só executa se passou mais de 1 hora
    fetch("/api/xbz/sincronizar")
      .then((r) => r.json())
      .then((data) => {
        if (data.ultimaSync) setUltimaSync(data.ultimaSync);
        if (data.sincronizado) carregar();
      })
      .catch(() => {});
  }, []);

  const cores = useMemo(() => {
    const set = new Set<string>();
    produtos.forEach((p) => { if (p.cor) set.add(p.cor.trim()); });
    return Array.from(set).sort();
  }, [produtos]);

  const resultados = useMemo(() => {
    if (!buscaAtiva) return [];
    return produtos
      .filter((p) => {
        if (filtros.origem === "xbz" && !p.origemXbz) return false;
        if (filtros.origem === "manual" && p.origemXbz) return false;

        if (filtros.texto) {
          const q = filtros.texto.toLowerCase();
          const match =
            p.nome?.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.informacaoTecnica?.toLowerCase().includes(q);
          if (!match) return false;
        }

        if (filtros.quantidade) {
          const qtd = Number(filtros.quantidade);
          if (!isNaN(qtd) && (p.estoque === undefined || p.estoque < qtd)) return false;
        }

        if (filtros.precoMin) {
          const min = Number(filtros.precoMin);
          if (!isNaN(min) && p.precoCusto < min) return false;
        }

        if (filtros.precoMax) {
          const max = Number(filtros.precoMax);
          if (!isNaN(max) && p.precoCusto > max) return false;
        }

        if (filtros.cor && p.cor?.trim() !== filtros.cor) return false;

        return true;
      })
      .sort((a, b) => {
        const semA = a.estoque !== undefined && a.estoque <= 0;
        const semB = b.estoque !== undefined && b.estoque <= 0;
        if (semA && !semB) return 1;
        if (!semA && semB) return -1;
        return 0;
      });
  }, [produtos, filtros, buscaAtiva]);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    setBuscaAtiva(true);
  }

  function limpar() {
    setFiltros(FILTROS_VAZIOS);
    setBuscaAtiva(false);
  }

  function setF(campo: keyof typeof FILTROS_VAZIOS, valor: string) {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  }

  async function sincronizar() {
    setSincronizando(true);
    setResultadoSync(null);
    setErroSync(null);
    try {
      const res = await fetch("/api/xbz/sincronizar", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setErroSync(data.error || "Erro ao sincronizar."); return; }
      setResultadoSync({ criados: data.criados, atualizados: data.atualizados });
      setUltimaSync(new Date().toISOString());
      carregar();
    } catch {
      setErroSync("Não foi possível conectar à API XBZ.");
    } finally {
      setSincronizando(false);
    }
  }

  const xbzCount = produtos.filter((p) => p.origemXbz).length;
  const manualCount = produtos.filter((p) => !p.origemXbz).length;

  const INPUT = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30";

  function formatarTempoRelativo(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "agora";
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    return `há ${Math.floor(diff / 86400)} dias`;
  }

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-6xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Consulta de Produtos</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {produtos.length} cadastrados · {xbzCount} via XBZ · {manualCount} manuais
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {ultimaSync && !sincronizando && (
              <span className="text-xs text-gray-400 hidden sm:block">
                Atualizado {formatarTempoRelativo(ultimaSync)}
              </span>
            )}
            <button
              onClick={sincronizar}
              disabled={sincronizando}
              className="flex items-center gap-2 border border-[#fb4d06]/20 text-[#fb4d06] bg-[#fb4d06]/5 hover:bg-[#fb4d06]/10 text-sm font-semibold py-2 px-4 rounded-xl transition disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${sincronizando ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {sincronizando ? "Sincronizando..." : "Sincronizar XBZ"}
            </button>
            <Link href="/produtos/novo">
              <button className="bg-[#fb4d06] text-white text-sm font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition">
                + Novo Produto
              </button>
            </Link>
          </div>
        </div>

        {/* Feedback sync */}
        {resultadoSync && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Sincronização concluída — <strong>{resultadoSync.criados} novos</strong>, <strong>{resultadoSync.atualizados} atualizados</strong>.
            <button onClick={() => setResultadoSync(null)} className="ml-auto text-green-500 hover:text-green-700">✕</button>
          </div>
        )}
        {erroSync && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {erroSync}
            <button onClick={() => setErroSync(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Filtros */}
        <form onSubmit={buscar} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Filtros de Busca</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">

            {/* Nome / Código */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome ou código do produto</label>
              <input
                className={INPUT}
                placeholder="Ex: caneca, BON-001, acrílica..."
                value={filtros.texto}
                onChange={(e) => setF("texto", e.target.value)}
              />
            </div>

            {/* Quantidade */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Quantidade desejada</label>
              <input
                className={INPUT}
                type="number"
                min="0"
                placeholder="Ex: 100"
                value={filtros.quantidade}
                onChange={(e) => setF("quantidade", e.target.value)}
              />
            </div>

            {/* Preço mín */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Preço de custo mínimo (R$)</label>
              <input
                className={INPUT}
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 5,00"
                value={filtros.precoMin}
                onChange={(e) => setF("precoMin", e.target.value)}
              />
            </div>

            {/* Preço máx */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Preço de custo máximo (R$)</label>
              <input
                className={INPUT}
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 50,00"
                value={filtros.precoMax}
                onChange={(e) => setF("precoMax", e.target.value)}
              />
            </div>

            {/* Cor */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cor</label>
              <select
                className={INPUT}
                value={filtros.cor}
                onChange={(e) => setF("cor", e.target.value)}
              >
                <option value="">Todas as cores</option>
                {cores.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Origem + botões */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {([
                { key: "todos", label: "Todos" },
                { key: "xbz", label: "XBZ Brindes" },
                { key: "manual", label: "Manuais" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setF("origem", key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    filtros.origem === key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={limpar}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
              >
                Limpar
              </button>
              <button
                type="submit"
                disabled={carregando}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#fb4d06] text-white hover:opacity-90 transition disabled:opacity-50"
              >
                Buscar
              </button>
            </div>
          </div>
        </form>

        {/* Resultados */}
        {!buscaAtiva ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <p className="text-sm">Preencha os filtros acima e clique em <strong>Buscar</strong></p>
          </div>
        ) : resultados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">Nenhum produto encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">{resultados.length} produto{resultados.length !== 1 ? "s" : ""} encontrado{resultados.length !== 1 ? "s" : ""}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {resultados.map((p) => (
                <Link key={p.id} href={`/produtos/${p.id}`}>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#fb4d06]/20 transition cursor-pointer overflow-hidden">
                    <div className="w-full h-40 bg-gray-50 flex items-center justify-center overflow-hidden relative">
                      {p.imagemUrl ? (
                        <Image src={p.imagemUrl.trim()} alt={p.nome} width={160} height={160} className="object-cover w-full h-full" unoptimized={p.origemXbz} />
                      ) : (
                        <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      )}
                      {p.origemXbz && (
                        <span className="absolute top-2 left-2 text-xs font-bold bg-[#fb4d06] text-white px-2 py-0.5 rounded-lg">XBZ</span>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-gray-800 text-sm leading-tight line-clamp-2">{p.nome}</h3>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${p.status === "Ativo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {p.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mb-1">SKU: {p.sku}{p.cor ? ` · ${p.cor}` : ""}</p>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {p.estoque !== undefined ? badgeEstoque(p.estoque) : <span />}
                        <span className="text-sm font-bold text-gray-800">
                          {p.precoCusto?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </WorkspaceLayout>
  );
}
