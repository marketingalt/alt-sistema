"use client";

import { useState } from "react";

function adicionarDiasUteis(from: Date, n: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d;
}

function contarDiasUteis(from: Date, to: Date): number {
  if (to <= from) return 0;
  let count = 0;
  const d = new Date(from);
  while (d < to) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return count;
}

const DIAS_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function fmtData(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

function dateToIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoToDate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, dia] = iso.split("-").map(Number);
  if (!y || !m || !dia) return null;
  return new Date(y, m - 1, dia);
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  sugestaoDias?: number | null;
}

export default function CampoPrazoEntrega({ value, onChange, sugestaoDias }: Props) {
  const [modo, setModo] = useState<"dias" | "data" | "livre">(() => {
    if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) return "data";
    if (/^\d+\s+dias?/i.test(value)) return "dias";
    return "livre";
  });

  const [dias, setDias] = useState<string>(() => {
    const m = /^(\d+)\s+dias?/i.exec(value);
    return m ? m[1] : "";
  });

  const [dataIso, setDataIso] = useState<string>(() => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const nDias = parseInt(dias) || 0;
  const dataPreview = nDias > 0 ? adicionarDiasUteis(hoje, nDias) : null;
  const dataObj = isoToDate(dataIso);
  const diasPreview = dataObj ? contarDiasUteis(hoje, dataObj) : null;

  function aplicarDias(n: string) {
    setDias(n);
    const nd = parseInt(n);
    if (nd > 0) onChange(`${nd} dias úteis a partir do aceite da proposta`);
  }

  function aplicarData(iso: string) {
    setDataIso(iso);
    const d = isoToDate(iso);
    if (d) {
      const nd = contarDiasUteis(hoje, d);
      onChange(`${fmtData(d)} (${nd} dias úteis a partir do aceite da proposta)`);
    }
  }

  function usarSugestao() {
    if (!sugestaoDias) return;
    setModo("dias");
    aplicarDias(String(sugestaoDias));
  }

  const MODOS = [
    { id: "dias",  label: "Por dias" },
    { id: "data",  label: "Por data" },
    { id: "livre", label: "Não selecionar agora" },
  ] as const;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-500">Prazo de Entrega</label>
        {!!sugestaoDias && (
          <button
            type="button"
            onClick={usarSugestao}
            className="flex items-center gap-1 text-[11px] text-[#fb4d06] font-semibold hover:underline"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Sugestão: {sugestaoDias} dias úteis
          </button>
        )}
      </div>

      {/* Toggle modo */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setModo(m.id);
              if (m.id === "livre") onChange("a combinar");
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
              modo === m.id
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Input por dias */}
      {modo === "dias" && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
              value={dias}
              onChange={(e) => aplicarDias(e.target.value)}
              placeholder="Ex: 15"
            />
            <span className="text-xs text-gray-500 whitespace-nowrap">dias úteis</span>
          </div>
          {dataPreview && (
            <span className="text-xs text-gray-400">
              → previsto:{" "}
              <strong className="text-gray-700">{fmtData(dataPreview)}</strong>
              <span className="ml-1">({DIAS_PT[dataPreview.getDay()]})</span>
            </span>
          )}
        </div>
      )}

      {/* Input por data */}
      {modo === "data" && (
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
            value={dataIso}
            min={dateToIso(hoje)}
            onChange={(e) => aplicarData(e.target.value)}
          />
          {diasPreview !== null && diasPreview > 0 && (
            <span className="text-xs text-gray-500 leading-snug">
              <strong className="text-gray-700">{diasPreview} dias úteis</strong>
              {" "}a partir do aceite da proposta
            </span>
          )}
        </div>
      )}

      {/* Texto livre */}
      {modo === "livre" && (
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
