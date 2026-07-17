"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Fornecedor } from "@/app/types";
import ModalNovoFornecedor from "./ModalNovoFornecedor";

interface Props {
  value: string;
  onSelect: (f: Fornecedor) => void;
  onChange: (valor: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export default function ComboboxFornecedor({
  value,
  onSelect,
  onChange,
  label = "Fornecedor",
  placeholder = "Buscar fornecedor cadastrado...",
  required = false,
  className = "",
}: Props) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState(value);
  const [modalNovo, setModalNovo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/fornecedores").then((r) => r.json()).then(setFornecedores);
  }, []);

  useEffect(() => { setBusca(value); }, [value]);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  const filtrados = busca.trim().length < 1
    ? fornecedores
    : fornecedores.filter((f) => {
        const q = busca.toLowerCase();
        return (
          f.nomeFantasia?.toLowerCase().includes(q) ||
          f.razaoSocial?.toLowerCase().includes(q) ||
          f.cnpj?.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
          f.nomeContato?.toLowerCase().includes(q)
        );
      });

  // Agrupa por CNPJ (sem máscara); sem CNPJ ficam isolados
  const grupos: Fornecedor[][] = useMemo(() => {
    const map = new Map<string, Fornecedor[]>();
    filtrados.forEach((f) => {
      const key = f.cnpj?.replace(/\D/g, "") || `_${f.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    });
    return [...map.values()];
  }, [filtrados]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setBusca(v);
    onChange(v);
    setAberto(true);
  }

  function selecionar(f: Fornecedor) {
    const nome = f.nomeFantasia || f.razaoSocial;
    setBusca(nome);
    onChange(nome);
    onSelect(f);
    setAberto(false);
  }

  function handleNovoFornecedor(f: Fornecedor) {
    setFornecedores((prev) => [f, ...prev]);
    selecionar(f);
    setModalNovo(false);
  }

  return (
    <>
      <div ref={containerRef} className={`relative ${className}`}>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
          value={busca}
          onChange={handleInput}
          onFocus={() => setAberto(true)}
          placeholder={placeholder}
          autoComplete="off"
        />

        {aberto && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            <ul className="max-h-64 overflow-y-auto">
              {grupos.length === 0 && busca.trim().length > 0 ? (
                <li className="px-4 py-3 text-sm text-gray-400">Nenhum fornecedor encontrado</li>
              ) : (
                grupos.map((grupo, gi) =>
                  grupo.length > 1 ? (
                    // Mesmo CNPJ: mostrar nome fantasia + clientes lado a lado
                    <li key={gi} className="px-3 py-3 border-b border-gray-50">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        {grupo[0].cnpj} · {grupo[0].razaoSocial}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {grupo.map((f) => (
                          <button
                            key={f.id}
                            onMouseDown={() => selecionar(f)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#fb4d06]/5 text-[#fb4d06] border border-[#fb4d06]/20 hover:bg-[#fb4d06]/15 transition"
                          >
                            {f.nomeFantasia || f.razaoSocial}
                          </button>
                        ))}
                      </div>
                    </li>
                  ) : (
                    // Fornecedor único
                    <li
                      key={gi}
                      onMouseDown={() => selecionar(grupo[0])}
                      className="flex items-center justify-between px-3 py-2.5 hover:bg-[#fb4d06]/5 cursor-pointer transition border-b border-gray-50 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {grupo[0].nomeFantasia || grupo[0].razaoSocial}
                        </p>
                        {grupo[0].nomeContato && (
                          <p className="text-xs text-gray-400">{grupo[0].nomeContato}</p>
                        )}
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                        grupo[0].status === "Ativo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {grupo[0].status}
                      </span>
                    </li>
                  )
                )
              )}
            </ul>

            {/* Adicionar novo fornecedor */}
            <div
              onMouseDown={(e) => { e.preventDefault(); setAberto(false); setModalNovo(true); }}
              className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition"
            >
              <div className="w-5 h-5 rounded-full bg-[#fb4d06] flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-[#fb4d06]">Adicionar novo fornecedor</span>
            </div>
          </div>
        )}
      </div>

      {modalNovo && (
        <ModalNovoFornecedor
          onSalvar={handleNovoFornecedor}
          onFechar={() => setModalNovo(false)}
        />
      )}
    </>
  );
}
