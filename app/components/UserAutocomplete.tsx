"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface UserOption {
  id: string;
  nome: string;
  email: string;
  imagemUrl?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Se true, exibe o nome do usuário selecionado em vez do valor bruto */
  displayNome?: boolean;
  className?: string;
}

/** Autocomplete que busca usuários cadastrados no sistema */
export default function UserAutocomplete({
  value,
  onChange,
  placeholder = "Selecionar usuário...",
  displayNome = false,
  className = "",
}: Props) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carrega usuários uma vez
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/admin/usuarios")
      .then((r) => r.json())
      .then((data: UserOption[]) => {
        if (cancelled) return;
        setUsers(data);
        // Se tem value, preenche o input com o nome
        if (value && displayNome) {
          const found = data.find(
            (u) => u.nome === value || u.email === value || u.id === value
          );
          if (found) setInputValue(found.nome);
        }
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Atualiza inputValue quando value muda externamente
  useEffect(() => {
    if (displayNome && users.length > 0 && value) {
      const found = users.find(
        (u) => u.nome === value || u.email === value || u.id === value
      );
      if (found && found.nome !== inputValue) setInputValue(found.nome);
    }
  }, [value, users]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtrados = users.filter((u) => {
    const termo = inputValue.toLowerCase();
    if (!termo) return false;
    const match =
      u.nome.toLowerCase().includes(termo) ||
      u.email.toLowerCase().includes(termo);
    if (!match) return false;
    return true;
  });

  const selecionado = displayNome && value
    ? users.find((u) => u.nome === value || u.email === value || u.id === value)
    : null;

  function handleSelect(user: UserOption) {
    setInputValue(user.nome);
    onChange(user.nome); // Sempre salva o nome
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleInputChange(val: string) {
    setInputValue(val);
    setOpen(true);
    // Se limpou o input, limpa o valor também
    if (!val.trim()) {
      onChange("");
    }
  }

  function handleBlur() {
    // Se perdeu o foco e o input está vazio, limpa
    if (!inputValue.trim()) {
      onChange("");
    }
    // Fecha o dropdown com delay pra permitir click
    setTimeout(() => setOpen(false), 200);
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
      />

      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-[#fb4d06] rounded-full animate-spin" />
        </div>
      )}

      {selecionado && !inputValue && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div
            className="w-5 h-5 rounded-full bg-cover bg-center"
            style={{ backgroundImage: selecionado.imagemUrl ? `url(${selecionado.imagemUrl})` : undefined }}
          >
            {!selecionado.imagemUrl && (
              <div className="w-full h-full rounded-full bg-[#fb4d06]/10 flex items-center justify-center">
                <span className="text-[8px] font-bold text-[#fb4d06]">
                  {selecionado.nome.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {inputValue.trim() === "" ? (
            <div className="px-4 py-3 text-xs text-gray-400 text-center">
              Digite o nome ou email do usuário
            </div>
          ) : filtrados.length === 0 ? (
            <div className="px-4 py-3 text-xs text-gray-400 text-center">
              {loading ? "Carregando..." : "Nenhum usuário encontrado"}
            </div>
          ) : (
            filtrados.slice(0, 15).map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelect(user)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition border-b border-gray-50 last:border-0 ${
                  value === user.nome ? "bg-orange-50" : ""
                }`}
              >
                <div
                  className="w-7 h-7 rounded-full bg-cover bg-center shrink-0"
                  style={{ backgroundImage: user.imagemUrl ? `url(${user.imagemUrl})` : undefined }}
                >
                  {!user.imagemUrl && (
                    <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-500">
                        {user.nome.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-800 truncate">{user.nome}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
