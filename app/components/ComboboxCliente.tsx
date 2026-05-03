"use client";

import { useEffect, useRef, useState } from "react";
import type { Cliente } from "@/app/types";

interface Props {
  value: string;
  onSelect: (cliente: Cliente) => void;
  onChange: (valor: string) => void;
}

export default function ComboboxCliente({ value, onSelect, onChange }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/clientes").then((r) => r.json()).then(setClientes);
  }, []);

  useEffect(() => { setBusca(value); }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtrados = busca.length < 1 ? clientes.slice(0, 8) : clientes.filter((c) => {
    const q = busca.toLowerCase();
    return c.nomeEmpresa?.toLowerCase().includes(q) ||
      c.razaoSocial?.toLowerCase().includes(q) ||
      c.nomeContato?.toLowerCase().includes(q);
  }).slice(0, 8);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setBusca(v);
    onChange(v);
    setAberto(true);
  }

  function selecionar(c: Cliente) {
    setBusca(c.nomeEmpresa || c.razaoSocial);
    onChange(c.nomeEmpresa || c.razaoSocial);
    onSelect(c);
    setAberto(false);
  }

  return (
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
      {aberto && filtrados.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {filtrados.map((c) => (
            <li
              key={c.id}
              onMouseDown={() => selecionar(c)}
              className="flex items-center justify-between px-3 py-2.5 hover:bg-[#fb4d06]/5 cursor-pointer transition"
            >
              <div>
                <p className="text-sm font-semibold text-gray-800">{c.nomeEmpresa || c.razaoSocial}</p>
                {c.nomeContato && <p className="text-xs text-gray-400">{c.nomeContato}</p>}
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.status === "Ativo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {c.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
