"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Produto } from "@/app/types";
import ModalNovoProduto from "./ModalNovoProduto";

interface Props {
  value: string;
  onChange: (v: string) => void;
  produtos: Produto[];
  onSelect: (p: Produto) => void;
  onNovoProduto: (p: Produto) => void;
}

function Thumbnail({ p }: { p: Produto }) {
  return (
    <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
      {p.imagemUrl ? (
        <Image
          src={p.imagemUrl.trim()}
          alt={p.nome}
          width={36} height={36}
          className="object-cover w-full h-full"
          unoptimized={p.origemXbz || p.imagemUrl.startsWith("data:")}
        />
      ) : (
        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )}
    </div>
  );
}

export default function BuscaProdutoInput({ value, onChange, produtos, onSelect, onNovoProduto }: Props) {
  const [aberto, setAberto] = useState(false);
  const [modal, setModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  const filtrados = value.trim().length === 0
    ? []
    : produtos.filter((p) => {
        const q = value.toLowerCase();
        return (
          p.nome?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.marca?.toLowerCase().includes(q)
        );
      });

  // Group by name (case-insensitive). Groups with multiple entries = color variants.
  const grupos = useMemo(() => {
    const map = new Map<string, Produto[]>();
    filtrados.forEach((p) => {
      const key = p.nome.trim().toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return [...map.values()];
  }, [filtrados]);

  const semResultado = value.trim().length >= 2 && filtrados.length === 0;

  function selecionar(p: Produto) {
    onSelect(p);
    setAberto(false);
  }

  function handleNovoProduto(p: Produto) {
    setModal(false);
    onNovoProduto(p);
    setAberto(false);
  }

  return (
    <>
      <div ref={containerRef} className="relative w-full">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
            placeholder="Buscar produto ou digitar nome..."
            value={value}
            onChange={(e) => { onChange(e.target.value); setAberto(true); }}
            onFocus={() => setAberto(true)}
          />
        </div>

        {aberto && (grupos.length > 0 || semResultado) && (
          <div className="absolute z-40 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            {grupos.length > 0 && (
              <ul className="max-h-64 overflow-y-auto">
                {grupos.map((grupo, gi) => {
                  const temCores = grupo.length > 1 && grupo.every((p) => p.cor);

                  if (temCores) {
                    return (
                      <li key={gi} className="px-3 py-2.5 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Thumbnail p={grupo[0]} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{grupo[0].nome}</p>
                            <p className="text-xs text-gray-400">
                              {grupo[0].sku && `${grupo[0].sku} · `}{grupo[0].marca}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-gray-700 shrink-0">
                            {grupo[0].precoCusto?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 ml-11">
                          {grupo.map((p) => (
                            <button
                              key={p.id}
                              onMouseDown={() => selecionar(p)}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-gray-300 bg-gray-50 text-gray-700 hover:bg-[#fb4d06]/10 hover:border-[#fb4d06]/40 hover:text-[#fb4d06] transition"
                            >
                              {p.cor}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  }

                  return grupo.map((p) => (
                    <li
                      key={p.id}
                      onMouseDown={() => selecionar(p)}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#fb4d06]/5 cursor-pointer transition border-b border-gray-50 last:border-0"
                    >
                      <Thumbnail p={p} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{p.nome}</p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-gray-400">{p.sku}{p.marca ? ` · ${p.marca}` : ""}</p>
                          {p.cor && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{p.cor}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-bold text-gray-700 shrink-0">
                        {p.precoCusto?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </li>
                  ));
                })}
              </ul>
            )}

            {semResultado && (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-400">Item não encontrado nos cadastros</p>
                <button
                  onMouseDown={(e) => { e.preventDefault(); setAberto(false); setModal(true); }}
                  className="text-xs font-semibold text-[#fb4d06] hover:underline whitespace-nowrap"
                >
                  Cadastrar agora →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {modal && (
        <ModalNovoProduto
          nomeInicial={value}
          onSalvar={handleNovoProduto}
          onFechar={() => setModal(false)}
        />
      )}
    </>
  );
}
