"use client";

import { useState, useMemo } from "react";
import type { RecorrenciaConfig, UnidadeRecorrencia, DiaSemana } from "@/app/types";

interface Props {
  valorInicial?: RecorrenciaConfig;
  onSalvar: (config: RecorrenciaConfig) => void;
  onFechar: () => void;
}

const UNIDADES: { value: UnidadeRecorrencia; label: string }[] = [
  { value: "dia", label: "Dias" },
  { value: "semana", label: "Semanas" },
  { value: "mes", label: "Meses" },
  { value: "ano", label: "Anos" },
];

const DIAS_SEMANA: { value: DiaSemana; label: string }[] = [
  { value: 0, label: "D" },
  { value: 1, label: "S" },
  { value: 2, label: "T" },
  { value: 3, label: "Q" },
  { value: 4, label: "Q" },
  { value: 5, label: "S" },
  { value: 6, label: "S" },
];

const INPUT_CLASS =
  "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white";

// ── Helpers de data ───────────────────────────────

function brParaInput(v: string): string {
  if (!v) return "";
  const partes = v.split("/");
  if (partes.length !== 3) return "";
  const [d, m, a] = partes;
  return `${a}-${m?.padStart(2, "0")}-${d?.padStart(2, "0")}`;
}

function inputParaBr(v: string): string {
  if (!v) return "";
  const [a, m, d] = v.split("-");
  return `${d}/${m}/${a}`;
}

function hojeInput(): string {
  const agora = new Date();
  const d = String(agora.getDate()).padStart(2, "0");
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const a = agora.getFullYear();
  return `${d}/${m}/${a}`;
}

export default function ModalRecorrenciaPersonalizada({
  valorInicial,
  onSalvar,
  onFechar,
}: Props) {
  const [intervalo, setIntervalo] = useState(valorInicial?.intervalo ?? 1);
  const [unidade, setUnidade] = useState<UnidadeRecorrencia>(
    valorInicial?.unidade ?? "semana"
  );
  const [diasSemana, setDiasSemana] = useState<DiaSemana[]>(
    valorInicial?.diasSemana ?? []
  );
  const [tipoTermino, setTipoTermino] = useState<"nunca" | "em" | "apos">(
    valorInicial?.termino?.tipo ?? "nunca"
  );
  const [dataTermino, setDataTermino] = useState(
    valorInicial?.termino?.data ?? hojeInput()
  );
  const [ocorrencias, setOcorrencias] = useState(
    valorInicial?.termino?.ocorrencias ?? 13
  );

  const mostrarDiasSemana = unidade === "semana";

  function toggleDia(dia: DiaSemana) {
    setDiasSemana((prev) =>
      prev.includes(dia)
        ? prev.filter((d) => d !== dia)
        : [...prev, dia]
    );
  }

  function salvar() {
    if (intervalo < 1) {
      alert("O intervalo mínimo é 1.");
      return;
    }
    if (mostrarDiasSemana && diasSemana.length === 0) {
      alert("Selecione ao menos um dia da semana.");
      return;
    }
    if (tipoTermino === "em" && !dataTermino) {
      alert("Informe a data de término.");
      return;
    }
    if (tipoTermino === "apos" && (!ocorrencias || ocorrencias < 1)) {
      alert("Informe o número de ocorrências (mínimo 1).");
      return;
    }

    const config: RecorrenciaConfig = {
      intervalo,
      unidade,
      diasSemana: mostrarDiasSemana ? diasSemana : undefined,
      termino: {
        tipo: tipoTermino,
        ...(tipoTermino === "em" ? { data: dataTermino } : {}),
        ...(tipoTermino === "apos" ? { ocorrencias } : {}),
      },
    };

    onSalvar(config);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onFechar}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Recorrência personalizada
            </h2>
          </div>
          <button
            onClick={onFechar}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────── */}
        <div className="p-6 flex flex-col gap-6">

          {/* Repetir a cada */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Repetir a cada:
            </label>
            <div className="flex gap-2">
              <div className="relative w-20">
                <input
                  type="number"
                  min={1}
                  value={intervalo}
                  onChange={(e) => setIntervalo(Number(e.target.value) || 1)}
                  className={`${INPUT_CLASS} text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setIntervalo((v) => v + 1)}
                    className="w-4 h-3.5 flex items-center justify-center text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setIntervalo((v) => Math.max(1, v - 1))}
                    className="w-4 h-3.5 flex items-center justify-center text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              <select
                value={unidade}
                onChange={(e) => {
                  setUnidade(e.target.value as UnidadeRecorrencia);
                  if (e.target.value !== "semana") {
                    setDiasSemana([]);
                  }
                }}
                className={`${INPUT_CLASS} flex-1 cursor-pointer appearance-none bg-no-repeat`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundPosition: "right 10px center",
                  paddingRight: "32px",
                }}
              >
                {UNIDADES.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dias da semana (condicional) */}
          {mostrarDiasSemana && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Repetir:
              </label>
              <div className="flex gap-1.5">
                {DIAS_SEMANA.map((dia) => (
                  <button
                    key={dia.value}
                    type="button"
                    onClick={() => toggleDia(dia.value)}
                    className={`
                      w-9 h-9 rounded-full text-sm font-medium transition-all
                      ${
                        diasSemana.includes(dia.value)
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }
                    `}
                  >
                    {dia.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Termina em */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Termina em
            </label>
            <div className="flex flex-col gap-3">
              {/* Nunca */}
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="termino"
                  checked={tipoTermino === "nunca"}
                  onChange={() => setTipoTermino("nunca")}
                  className="w-4 h-4 accent-gray-900"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                  Nunca
                </span>
              </label>

              {/* Em */}
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="termino"
                  checked={tipoTermino === "em"}
                  onChange={() => setTipoTermino("em")}
                  className="w-4 h-4 accent-gray-900"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 mr-2">
                  Em
                </span>
                <input
                  type="date"
                  value={brParaInput(dataTermino)}
                  onChange={(e) => setDataTermino(inputParaBr(e.target.value))}
                  disabled={tipoTermino !== "em"}
                  className={`
                    flex-1 rounded-lg px-3 py-1.5 text-sm border
                    focus:outline-none focus:ring-2
                    [&::-webkit-calendar-picker-indicator]:opacity-60
                    [&::-webkit-calendar-picker-indicator]:cursor-pointer
                    [&::-webkit-calendar-picker-indicator]:hover:opacity-100
                    ${
                      tipoTermino === "em"
                        ? "border-gray-200 bg-white focus:ring-[#fb4d06]/30 text-gray-700"
                        : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                    }
                  `}
                />
              </label>

              {/* Após */}
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="termino"
                  checked={tipoTermino === "apos"}
                  onChange={() => setTipoTermino("apos")}
                  className="w-4 h-4 accent-gray-900"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 mr-2">
                  Após
                </span>
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={1}
                    value={ocorrencias}
                    onChange={(e) => setOcorrencias(Number(e.target.value) || 1)}
                    disabled={tipoTermino !== "apos"}
                    className={`
                      w-full rounded-lg px-3 py-1.5 text-sm border
                      focus:outline-none focus:ring-2
                      [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none
                      ${
                        tipoTermino === "apos"
                          ? "border-gray-200 bg-white focus:ring-[#fb4d06]/30 text-gray-700"
                          : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                      }
                    `}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                    ocorrências
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onFechar}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            className="flex-1 py-2.5 rounded-xl bg-[#fb4d06] text-white text-sm font-semibold hover:opacity-90 transition"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
