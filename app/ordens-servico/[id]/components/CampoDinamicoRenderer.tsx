"use client";

import type { CampoDinamicoDef } from "@/app/types";

interface Props {
  campo: CampoDinamicoDef;
  valor: any;
  onChange: (valor: any) => void;
}

/** Renderiza um campo dinâmico com base no seu tipo */
export default function CampoDinamicoRenderer({ campo, valor, onChange }: Props) {
  switch (campo.tipo) {
    case "texto":
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {campo.nome}
            {campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <input
            type="text"
            value={valor ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
          />
        </div>
      );

    case "textarea":
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {campo.nome}
            {campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <textarea
            value={valor ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
          />
        </div>
      );

    case "numero":
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {campo.nome}
            {campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <input
            type="number"
            value={valor ?? ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
          />
        </div>
      );

    case "checkbox":
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!valor}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-[#fb4d06] focus:ring-[#fb4d06]"
          />
          <span className="text-sm text-gray-700">
            {campo.nome}
            {campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
          </span>
        </label>
      );

    case "select":
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {campo.nome}
            {campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <select
            value={valor ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
          >
            <option value="">Selecionar...</option>
            {(campo.opcoes || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );

    case "multiselect":
      const selected: string[] = Array.isArray(valor) ? valor : [];
      function toggleOpt(opt: string) {
        if (selected.includes(opt)) {
          onChange(selected.filter((s) => s !== opt));
        } else {
          onChange([...selected, opt]);
        }
      }
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {campo.nome}
            {campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(campo.opcoes || []).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggleOpt(opt)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                  selected.includes(opt)
                    ? "bg-[#fb4d06] text-white border-[#fb4d06]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#fb4d06]/50"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );

    case "data":
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {campo.nome}
            {campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <input
            type="date"
            value={valor ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
          />
        </div>
      );

    case "medida":
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {campo.nome}
            {campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={(valor as { valor?: number })?.valor ?? ""}
              onChange={(e) =>
                onChange({ ...(valor || {}), valor: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="Valor"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
            />
            <input
              type="text"
              value={(valor as { unidade?: string })?.unidade ?? ""}
              onChange={(e) => onChange({ ...(valor || {}), unidade: e.target.value })}
              placeholder="Unidade (cm, mm, etc)"
              className="w-28 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
            />
          </div>
        </div>
      );

    default:
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {campo.nome} <span className="text-gray-400 text-xs">(tipo: "{campo.tipo}" — não reconhecido)</span>
          </label>
          <input
            type="text"
            value={valor ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
          />
        </div>
      );
  }
}
