"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Cliente } from "@/app/types";
import ModalNovoCliente from "./ModalNovoCliente";

interface Props {
  value: string;
  onSelect: (cliente: Cliente) => void;
  onChange: (valor: string) => void;
}

export default function ComboboxCliente({ value, onSelect, onChange }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState(value);
  const [modalNovo, setModalNovo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/clientes").then((r) => r.json()).then(setClientes);
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
    ? clientes.slice(0, 20)
    : clientes.filter((c) => {
        const q = busca.toLowerCase();
        return (
          c.nomeEmpresa?.toLowerCase().includes(q) ||
          c.razaoSocial?.toLowerCase().includes(q) ||
          c.cnpj?.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
          c.nomeContato?.toLowerCase().includes(q)
        );
      }).slice(0, 20);

  // Agrupa por CNPJ (sem máscara); clientes sem CNPJ ficam isolados
  const grupos: Cliente[][] = useMemo(() => {
    const map = new Map<string, Cliente[]>();
    filtrados.forEach((c) => {
      const key = c.cnpj?.replace(/\D/g, "") || `_${c.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return [...map.values()];
  }, [filtrados]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setBusca(v);
    onChange(v);
    setAberto(true);
  }

  function selecionar(c: Cliente) {
    const nome = c.nomeEmpresa || c.razaoSocial;
    setBusca(nome);
    onChange(nome);
    onSelect(c);
    setAberto(false);
  }

  function handleNovoCliente(c: Cliente) {
    setClientes((prev) => [c, ...prev]);
    selecionar(c);
    setModalNovo(false);
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
          value={busca}
          onChange={handleInput}
          onFocus={() => setAberto(true)}
          placeholder="Buscar cliente cadastrado..."
          autoComplete="off"
        />

        {aberto && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            <ul className="max-h-64 overflow-y-auto">
              {grupos.length === 0 && busca.trim().length > 0 ? (
                <li className="px-4 py-3 text-sm text-gray-400">Nenhum cliente encontrado</li>
              ) : (
                grupos.map((grupo, gi) =>
                  grupo.length > 1 ? (
                    // Mesmo CNPJ: mostrar nome da empresa + clientes lado a lado
                    <li key={gi} className="px-3 py-3 border-b border-gray-50">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        {grupo[0].cnpj} · {grupo[0].razaoSocial}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {grupo.map((c) => (
                          <button
                            key={c.id}
                            onMouseDown={() => selecionar(c)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#fb4d06]/5 text-[#fb4d06] border border-[#fb4d06]/20 hover:bg-[#fb4d06]/15 transition"
                          >
                            {c.nomeEmpresa || c.razaoSocial}
                          </button>
                        ))}
                      </div>
                    </li>
                  ) : (
                    // Cliente único
                    <li
                      key={gi}
                      onMouseDown={() => selecionar(grupo[0])}
                      className="flex items-center justify-between px-3 py-2.5 hover:bg-[#fb4d06]/5 cursor-pointer transition border-b border-gray-50 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {grupo[0].nomeEmpresa || grupo[0].razaoSocial}
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

            {/* Adicionar novo cliente */}
            <div
              onMouseDown={(e) => { e.preventDefault(); setAberto(false); setModalNovo(true); }}
              className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition"
            >
              <div className="w-5 h-5 rounded-full bg-[#fb4d06] flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-[#fb4d06]">Adicionar novo cliente</span>
            </div>
          </div>
        )}
      </div>

      {modalNovo && (
        <ModalNovoCliente
          onSalvar={handleNovoCliente}
          onFechar={() => setModalNovo(false)}
        />
      )}
    </>
  );
}
