"use client";

import { useMemo } from "react";
import type { ItemOrcamento, Produto } from "@/app/types";
import { estoqueVivo, excedeEstoque, sugerirSimilares } from "@/lib/estoque";

interface Props {
  item: ItemOrcamento;
  produtos: Produto[];
  onChangeQtd: (v: number) => void;
  onSelecionarSugestao: (p: Produto) => void;
  readOnly?: boolean;
}

function corBadge(estoque: number) {
  if (estoque <= 0) return "bg-red-100 text-red-600";
  if (estoque < 50) return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
}

function textoBadge(estoque: number) {
  if (estoque <= 0) return "Sem estoque";
  return `Estoque disponível: ${estoque} un.`;
}

/**
 * Campo de quantidade com controle de estoque XBZ.
 * Mostra o estoque disponível do item; se a quantidade exceder, avisa em
 * tempo real e sugere produtos de descrição semelhante com estoque suficiente.
 * `readOnly` é usado quando o item tem variações (quantidade calculada).
 */
export default function CampoQuantidadeEstoque({
  item,
  produtos,
  onChangeQtd,
  onSelecionarSugestao,
  readOnly,
}: Props) {
  const estoque = estoqueVivo(item, produtos);
  const excede = excedeEstoque(item, produtos);
  const sugestoes = useMemo(() => sugerirSimilares(item, produtos), [item, produtos]);

  const inputCls = `w-full border rounded-lg px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 ${
    excede
      ? "border-red-300 text-red-700 focus:ring-red-300"
      : "border-gray-200 text-gray-700 focus:ring-[#fb4d06]/30"
  }`;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1.5">
        {readOnly ? "Quantidade total (calculada)" : "Quantidade"}
      </label>

      {readOnly ? (
        <div className="w-full border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2.5 text-base text-emerald-700 font-semibold">
          {item.quantidade}
        </div>
      ) : (
        <input
          type="number"
          min={0}
          step="1"
          className={inputCls}
          value={item.quantidade || ""}
          onChange={(e) => onChangeQtd(Number(e.target.value))}
        />
      )}

      {estoque !== undefined && (
        <div className="mt-1.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${corBadge(estoque)}`}>
            {textoBadge(estoque)}
          </span>
        </div>
      )}

      {excede && estoque !== undefined && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
          <p className="text-xs font-semibold text-red-600">
            Estoque insuficiente — disponível: {estoque} un.
          </p>
          {sugestoes.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Sugestões com estoque disponível
              </p>
              <div className="flex flex-col gap-1">
                {sugestoes.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelecionarSugestao(p)}
                    className="text-left text-xs px-2.5 py-1.5 rounded-md bg-white border border-gray-200 hover:border-[#fb4d06]/50 hover:bg-[#fb4d06]/5 transition"
                  >
                    <span className="font-semibold text-gray-700">{p.nome}</span>
                    {p.cor && <span className="ml-1.5 text-gray-400">· {p.cor}</span>}
                    <span className="ml-1.5 text-emerald-600 font-semibold">{p.estoque} un.</span>
                    {p.precoCusto != null && (
                      <span className="ml-1.5 text-gray-500">
                        {p.precoCusto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
