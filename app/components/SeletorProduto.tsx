"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Produto } from "@/app/types";

interface Props {
  produtos: Produto[];
  onSelect: (produto: Produto) => void;
}

function badgeEstoque(estoque?: number) {
  if (estoque === undefined) return null;
  if (estoque <= 0) return <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">Sem estoque</span>;
  if (estoque < 50) return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">{estoque} un.</span>;
  return <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">{estoque} un.</span>;
}

export default function SeletorProduto({ produtos, onSelect }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 50);
  }, [aberto]);

  const filtrados = busca.length < 1
    ? produtos.slice(0, 10)
    : produtos.filter((p) => {
        const q = busca.toLowerCase();
        return p.nome?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.marca?.toLowerCase().includes(q);
      }).slice(0, 10);

  function selecionar(p: Produto) {
    onSelect(p);
    setAberto(false);
    setBusca("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-[#fb4d06] hover:text-[#fb4d06] bg-[#fb4d06]/5 hover:bg-[#fb4d06]/10 px-3 py-1.5 rounded-lg transition"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        Buscar produto cadastrado
      </button>

      {aberto && (
        <div className="absolute z-50 mt-1 left-0 w-96 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <input
              ref={inputRef}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
              placeholder="Buscar por nome, SKU ou marca..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {filtrados.length === 0 ? (
              <li className="text-sm text-gray-400 text-center py-6">Nenhum produto encontrado</li>
            ) : filtrados.map((p) => (
              <li
                key={p.id}
                onMouseDown={() => selecionar(p)}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#fb4d06]/5 cursor-pointer transition border-b border-gray-50 last:border-0"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {p.imagemUrl ? (
                    <Image src={p.imagemUrl.trim()} alt={p.nome} width={40} height={40} className="object-cover w-full h-full" unoptimized={p.origemXbz} />
                  ) : (
                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.nome}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="text-xs text-gray-400">{p.sku}</span>
                    {p.origemXbz && <span className="text-xs font-bold text-[#fb4d06]">XBZ</span>}
                    {badgeEstoque(p.estoque)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-700">
                    {p.precoCusto?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <p className="text-xs text-gray-400">{p.fornecedorNome}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
