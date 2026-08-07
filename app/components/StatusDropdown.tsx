"use client";

import { useEffect, useRef, useState } from "react";
import type { StatusOrcamento } from "@/app/types";
import { STATUS_CONFIG } from "@/app/types";
import { apiFetch } from "@/lib/api-fetch";

const TODOS_STATUS = Object.keys(STATUS_CONFIG) as StatusOrcamento[];

function StatusBadge({ status }: { status: StatusOrcamento }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.cor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  );
}

interface StatusDropdownProps {
  orcamentoId: string;
  statusAtual: StatusOrcamento;
  /** Se true, não mostra o ícone de seta. Usado em espaços compactos. */
  semSeta?: boolean;
  /** Alinhamento do dropdown: "left" (padrão) ou "right" */
  alinhamento?: "left" | "right";
  /** Callback após mudança bem-sucedida */
  onChange?: (novo: StatusOrcamento) => void;
  /** Classe adicional no botão */
  className?: string;
  /** Tamanho do badge: "sm" (padrão) ou "md" */
  tamanho?: "sm" | "md";
  /** Confirmação extra antes de aprovar (verifica prazoPagamento) */
  confirmarAprovacao?: boolean;
  /** Callback chamado com o novo status ANTES de persistir, se retornar false cancela */
  onBeforeChange?: (novo: StatusOrcamento) => boolean | Promise<boolean>;
}

export default function StatusDropdown({
  orcamentoId,
  statusAtual,
  semSeta = false,
  alinhamento = "left",
  onChange,
  className = "",
  tamanho = "sm",
  confirmarAprovacao = false,
  onBeforeChange,
}: StatusDropdownProps) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  async function mudar(novo: StatusOrcamento) {
    setAberto(false);

    // Validação: se for aprovar, verificar prazoPagamento
    if (confirmarAprovacao && novo === "Aprovado") {
      // O callback onBeforeChange pode ser usado pelo pai para verificar
    }

    if (onBeforeChange) {
      const podeContinuar = await onBeforeChange(novo);
      if (!podeContinuar) return;
    }

    try {
      const res = await apiFetch(`/api/orcamentos/${orcamentoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novo }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao alterar status" }));
        console.error("Erro ao alterar status:", err);
        return;
      }
      onChange?.(novo);
    } catch (err) {
      console.error("Erro ao alterar status:", err);
    }
  }

  const badgeClass =
    tamanho === "md"
      ? "inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border"
      : "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border";

  const cfg = STATUS_CONFIG[statusAtual];

  return (
    <div ref={ref} className="relative" onClick={(e) => e.preventDefault()}>
      <button
        onClick={(e) => {
          e.preventDefault();
          setAberto((p) => !p);
        }}
        className={`${badgeClass} ${cfg.bg} ${cfg.cor} cursor-pointer ${className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {statusAtual}
        {!semSeta && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {aberto && (
        <div
          className={`absolute z-20 top-full mt-1 ${
            alinhamento === "right" ? "right-0" : "left-0"
          } bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]`}
        >
          {TODOS_STATUS.map((s) => (
            <button
              key={s}
              onClick={() => mudar(s)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${
                s === statusAtual ? "font-bold" : ""
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s].dot}`} />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
