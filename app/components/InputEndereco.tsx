"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

interface Sugestao {
  texto: string;
  display?: string;
  placeId: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export default function InputEndereco({ value, onChange, placeholder, className }: Props) {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [semResultado, setSemResultado] = useState(false);
  const [cep, setCep] = useState("");
  const [carregando, setCarregando] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fromSelectionRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false);
        setSemResultado(false);
        setCep("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (fromSelectionRef.current) {
      fromSelectionRef.current = false;
      return;
    }

    setSemResultado(false);
    setCep("");

    const query = value.trim();
    if (!query || query.length < 3) {
      setSugestoes([]);
      setAberto(false);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    const cepNums = query.replace(/\D/g, "");
    const delay = cepNums.length === 8 ? 0 : 420;

    timerRef.current = setTimeout(async () => {
      setCarregando(true);
      try {
        const res = await apiFetch(`/api/sugerir-endereco?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        const lista: Sugestao[] = data.sugestoes ?? [];
        setSugestoes(lista);
        if (lista.length > 0) {
          setAberto(true);
          setSemResultado(false);
        } else {
          setAberto(false);
          setSemResultado(true);
        }
      } catch {
        setSugestoes([]);
        setAberto(false);
        setSemResultado(false);
      } finally {
        setCarregando(false);
      }
    }, delay);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value]);

  function buscarComCep() {
    const cepNums = cep.replace(/\D/g, "");
    if (!cepNums) return;
    const novoValor = `${value.trim()}, ${cepNums}`;
    fromSelectionRef.current = false;
    setSemResultado(false);
    onChange(novoValor);
  }

  function selecionar(s: Sugestao) {
    fromSelectionRef.current = true;
    onChange(s.texto);
    setSugestoes([]);
    setAberto(false);
    setSemResultado(false);
    setCep("");
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          className={className ?? "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {carregando && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-3.5 h-3.5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </span>
        )}
      </div>

      {/* Dropdown de sugestões */}
      {aberto && sugestoes.length > 0 && (
        <ul className="absolute z-[70] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {sugestoes.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition"
                onMouseDown={(e) => { e.preventDefault(); selecionar(s); }}
              >
                <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#fb4d06]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <span className="text-gray-700 leading-snug">{s.display ?? s.texto}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* CEP fallback */}
      {semResultado && (
        <div className="mt-2 flex flex-col gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <p className="text-xs text-amber-700 font-medium">Endereço não encontrado — informe o CEP para refinar:</p>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-amber-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400/40 bg-white"
              placeholder="00000-000"
              value={cep}
              onChange={(e) => setCep(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarComCep(); } }}
              maxLength={9}
            />
            <button
              type="button"
              onClick={buscarComCep}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition"
            >
              Buscar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
