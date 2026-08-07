"use client";

import { useEffect, useRef, useState } from "react";
import type { Cliente } from "@/app/types";
import InputEndereco from "@/app/components/InputEndereco";
import { apiFetch } from "@/lib/api-fetch";

interface Props {
  enderecoSugerido?: string;
  enderecoOrigem?: string;
  clienteId?: string;
  onAplicar: (valor: string, valorNumerico?: number) => void;
  onFechar: () => void;
  onAplicarNumerico?: (total: number) => void;
  quantidadeItens?: number;
}

interface DistItem {
  destino: string;
  km: number;
  erro: boolean;
}

const TAXA_KM = 1.5;
const FATOR_OPERACIONAL = 1.1;
const OPERACIONAL_PCT = 10;

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CalculadoraFrete({
  enderecoSugerido = "",
  enderecoOrigem = "",
  clienteId,
  onAplicar,
  onFechar,
  onAplicarNumerico,
  quantidadeItens,
}: Props) {
  const [modo, setModo] = useState<"unico" | "multiplos">("unico");
  const [freteGratis, setFreteGratis] = useState(false);
  const [origem, setOrigem] = useState(enderecoOrigem);
  const [destino, setDestino] = useState(enderecoSugerido);
  const [destinos, setDestinos] = useState<string[]>([""]);
  const [km, setKm] = useState("");
  const [distItems, setDistItems] = useState<DistItem[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enderecoCliente, setEnderecoCliente] = useState(enderecoSugerido);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const kmNum = parseFloat(km.replace(",", ".")) || 0;
  const custo = kmNum * TAXA_KM * FATOR_OPERACIONAL;

  useEffect(() => {
    if (!clienteId) return;
    apiFetch(`/api/clientes/${clienteId}`)
      .then((r) => r.json())
      .then((c: Cliente) => {
        const addr = [c.endereco, c.bairro, c.cidade, c.estado].filter(Boolean).join(", ");
        if (addr) {
          setEnderecoCliente(addr);
          setDestino((prev) => prev || addr);
        }
      })
      .catch(() => {});
  }, [clienteId]);

  async function calcular() {
    const alvos = modo === "unico" ? [destino] : destinos.filter((d) => d.trim());
    if (!origem.trim()) { setErro("Informe o endereço de origem."); return; }
    if (!alvos[0]?.trim()) { setErro("Informe pelo menos um endereço de destino."); return; }

    setCalculando(true);
    setErro(null);

    try {
      const res = await apiFetch("/api/calcular-frete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origem: origem.trim(), destinos: alvos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const resultados: DistItem[] = data.resultados;
      setDistItems(resultados);

      const totalKm = resultados
        .filter((r) => !r.erro)
        .reduce((sum, r) => sum + r.km, 0);

      setKm(totalKm.toFixed(1));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao calcular distância.");
    } finally {
      setCalculando(false);
    }
  }

  function aplicar() {
    if (freteGratis) {
      if (onAplicarNumerico) onAplicarNumerico(0);
      else onAplicar("GRÁTIS", 0);
      return;
    }
    if (kmNum > 0) {
      if (onAplicarNumerico) {
        onAplicarNumerico(custo);
      } else {
        const desc =
          modo === "multiplos" && distItems.filter((r) => !r.erro).length > 1
            ? `${distItems.filter((r) => !r.erro).length} destinos · ${kmNum} km total`
            : `${kmNum} km`;
        onAplicar(`${fmt(custo)} (${desc})`, custo);
      }
    }
  }

  function carregarArquivo(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const linhas = content
        .split(/\r?\n/)
        .map((l) => l.split(/[,;]/)[0].trim().replace(/^"(.+)"$/, "$1"))
        .filter((l) => l.length > 8);
      if (linhas.length > 0) {
        setDestinos((prev) => {
          const existentes = prev.filter((d) => d.trim());
          return existentes.length > 0 ? [...existentes, ...linhas] : linhas;
        });
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  const podeAplicar = freteGratis || kmNum > 0;

  const labelAplicar = freteGratis
    ? "Aplicar: GRÁTIS"
    : kmNum > 0
    ? onAplicarNumerico
      ? `Usar: ${fmt(custo)}${quantidadeItens ? ` · ${fmt(custo / quantidadeItens)}/item` : ""}`
      : `Aplicar: ${fmt(custo)}`
    : "Aplicar ao orçamento";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Calculadora de Frete</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              R$ {TAXA_KM.toFixed(2)}/km + {OPERACIONAL_PCT}% custo operacional · via OpenStreetMap
            </p>
          </div>
          <button
            onClick={onFechar}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-5">

          {/* Frete Grátis */}
          <button
            type="button"
            onClick={() => setFreteGratis((p) => !p)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition text-left ${
              freteGratis ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${freteGratis ? "border-green-500 bg-green-500" : "border-gray-300"}`}>
              {freteGratis && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div>
              <p className={`text-sm font-semibold ${freteGratis ? "text-green-700" : "text-gray-700"}`}>Frete Grátis</p>
              <p className="text-xs text-gray-400">Nenhum valor de frete será cobrado do cliente</p>
            </div>
          </button>

          {!freteGratis && (
            <>
              {/* Origem */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Endereço de origem</label>
                <InputEndereco
                  value={origem}
                  onChange={setOrigem}
                  placeholder="Ex: Rua Augusta, 1000, São Paulo - SP"
                />
              </div>

              {/* Modo */}
              <div className="flex gap-2">
                {(["unico", "multiplos"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setModo(m); setDistItems([]); setErro(null); }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
                      modo === m
                        ? "border-[#fb4d06] bg-[#fb4d06]/5 text-[#fb4d06]"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {m === "unico" ? "Destino único" : "Múltiplos destinos"}
                  </button>
                ))}
              </div>

              {/* Destino único */}
              {modo === "unico" && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Endereço de destino</label>
                  <InputEndereco
                    value={destino}
                    onChange={setDestino}
                    placeholder="Ex: Av. Paulista, 1000, São Paulo - SP"
                  />
                  {enderecoCliente && destino !== enderecoCliente && (
                    <button
                      type="button"
                      onClick={() => setDestino(enderecoCliente)}
                      className="mt-1.5 text-[11px] text-[#fb4d06] hover:underline"
                    >
                      Usar endereço do cliente: {enderecoCliente}
                    </button>
                  )}
                </div>
              )}

              {/* Múltiplos destinos */}
              {modo === "multiplos" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-500">Endereços de destino</label>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) carregarArquivo(f); e.target.value = ""; }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Importar CSV / TXT
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                    {destinos.map((d, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span className="text-xs text-gray-400 w-5 shrink-0 text-right mt-2.5">{i + 1}.</span>
                        <div className="flex-1">
                          <InputEndereco
                            value={d}
                            onChange={(v) => setDestinos((prev) => prev.map((val, j) => j === i ? v : val))}
                            placeholder={`Endereço ${i + 1}`}
                          />
                        </div>
                        {destinos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setDestinos((prev) => prev.filter((_, j) => j !== i))}
                            className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 transition shrink-0 mt-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setDestinos((p) => [...p, ""])}
                    className="flex items-center gap-1 text-xs font-semibold text-[#fb4d06] hover:underline self-start"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Adicionar endereço
                  </button>

                  <p className="text-[10px] text-gray-400 -mt-1">
                    Para importar do Excel, salve como CSV primeiro. Um endereço por linha.
                  </p>
                </div>
              )}

              {/* Botão preencher km */}
              <button
                type="button"
                onClick={calcular}
                disabled={calculando}
                className="w-full py-2.5 rounded-xl bg-gray-800 text-white text-sm font-semibold hover:bg-gray-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                {calculando ? "Calculando distância..." : "Preencher km automaticamente"}
              </button>

              {/* Erro */}
              {erro && (
                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{erro}</span>
                </div>
              )}

              {/* Breakdown por destino (múltiplos) */}
              {modo === "multiplos" && distItems.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                        <th className="px-3 py-2 text-left w-6">#</th>
                        <th className="px-3 py-2 text-left">Destino</th>
                        <th className="px-3 py-2 text-right">km</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distItems.map((r, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 text-gray-700 max-w-[220px]">
                            <span className="block truncate" title={r.destino}>{r.destino}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {r.erro
                              ? <span className="text-red-400">Erro</span>
                              : <span className="text-gray-700">{r.km} km</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Campo km — sempre visível, editável */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Distância (km)
                  {distItems.length > 0 && (
                    <span className="ml-2 font-normal text-gray-400">preenchido pelo endereço · editável</span>
                  )}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    className="w-36 border-2 border-[#fb4d06]/40 rounded-xl px-4 py-3 text-2xl font-bold text-[#fb4d06] focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/40 text-center"
                    value={km}
                    onChange={(e) => setKm(e.target.value)}
                    placeholder="0"
                  />
                  <span className="text-sm font-medium text-gray-500">km</span>
                  {kmNum > 0 && (
                    <div className="flex-1 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      <p className="text-2xl font-bold text-green-700">{fmt(custo)}</p>
                      <p className="text-[11px] text-green-600 mt-0.5">
                        {kmNum} km × R$ {TAXA_KM.toFixed(2)}/km + {OPERACIONAL_PCT}% operacional
                      </p>
                      {onAplicarNumerico && quantidadeItens && quantidadeItens > 0 && (
                        <p className="text-[11px] font-semibold text-green-700 mt-1 pt-1 border-t border-green-200">
                          = {fmt(custo / quantidadeItens)} por item (÷ {quantidadeItens} unid.)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-100 shrink-0 flex gap-3">
          <button
            onClick={onFechar}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={aplicar}
            disabled={!podeAplicar}
            className="flex-[2] py-2.5 px-4 rounded-xl bg-[#fb4d06] text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
          >
            {labelAplicar}
          </button>
        </div>
      </div>
    </div>
  );
}
