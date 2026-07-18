"use client";

import { useEffect, useRef, useState } from "react";
import AvatarIniciais from "./AvatarIniciais";

interface UserOption {
  id: string;
  nome: string;
}

interface Props {
  value: { userId: string; nome: string }[];
  onChange: (value: { userId: string; nome: string }[]) => void;
  label?: string;
  placeholder?: string;
}

export default function MultiUserSelect({ value, onChange, label, placeholder = "Adicionar participante..." }: Props) {
  const [usuarios, setUsuarios] = useState<UserOption[]>([]);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then(setUsuarios)
      .catch(() => {});
  }, []);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selecionadosIds = new Set(value.map((p) => p.userId));

  const filtrados = usuarios.filter(
    (u) =>
      !selecionadosIds.has(u.id) &&
      u.nome.toLowerCase().includes(busca.toLowerCase())
  );

  function adicionar(user: UserOption) {
    onChange([...value, { userId: user.id, nome: user.nome }]);
    setBusca("");
    setAberto(false);
  }

  function remover(userId: string) {
    onChange(value.filter((p) => p.userId !== userId));
  }

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      )}

      {/* Chips dos selecionados */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((p) => (
            <span
              key={p.userId}
              className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 text-xs"
            >
              <AvatarIniciais nome={p.nome} size="sm" />
              <span className="text-gray-700 font-medium">{p.nome}</span>
              <button
                type="button"
                onClick={() => remover(p.userId)}
                className="text-gray-400 hover:text-red-500 transition ml-0.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input de busca */}
      <div className="relative">
        <input
          type="text"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
        />
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      </div>

      {/* Dropdown */}
      {aberto && busca && filtrados.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtrados.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => adicionar(u)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition"
            >
              <AvatarIniciais nome={u.nome} size="sm" />
              <span className="text-gray-700">{u.nome}</span>
            </button>
          ))}
        </div>
      )}

      {aberto && busca && filtrados.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm text-gray-400 text-center">
          Nenhum usuário encontrado
        </div>
      )}
    </div>
  );
}
