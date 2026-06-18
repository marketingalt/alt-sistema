"use client";

import { useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  prazoCliente?: string;
}

export default function CampoPrazoPagamento({ value, onChange, prazoCliente }: Props) {
  const lastCustomRef = useRef(
    value !== "A combinar" && value !== "à combinar" ? value : ""
  );

  const isCombinar = value === "A combinar" || value === "à combinar";
  const fromCliente = !!(prazoCliente && value === prazoCliente);

  function selecionarCombinar() {
    onChange("A combinar");
  }

  function selecionarPersonalizado() {
    onChange(lastCustomRef.current);
  }

  function onCustomChange(v: string) {
    lastCustomRef.current = v;
    onChange(v);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-500">Prazo de Pagamento</label>
        {fromCliente && (
          <span className="text-[11px] text-blue-500 font-medium">Do cadastro do cliente</span>
        )}
      </div>

      {/* Chip do cliente quando disponível e não selecionado */}
      {prazoCliente && !fromCliente && (
        <button
          type="button"
          onClick={() => { lastCustomRef.current = prazoCliente; onChange(prazoCliente); }}
          className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-700 hover:bg-blue-100 transition text-left"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="truncate">Usar do cliente: {prazoCliente}</span>
        </button>
      )}

      {/* Toggle A combinar / Personalizado */}
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          onClick={selecionarCombinar}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${
            isCombinar
              ? "bg-gray-800 text-white border-gray-800"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
          }`}
        >
          A combinar
        </button>
        <button
          type="button"
          onClick={selecionarPersonalizado}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${
            !isCombinar
              ? "bg-gray-800 text-white border-gray-800"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
          }`}
        >
          Personalizado
        </button>
      </div>

      {!isCombinar && (
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
          value={value}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="Ex: 30 dias, 50% entrada + 50% na entrega..."
        />
      )}
    </div>
  );
}
