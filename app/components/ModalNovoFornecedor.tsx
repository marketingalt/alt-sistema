"use client";

import { useState } from "react";
import type { Fornecedor } from "@/app/types";
import { apiFetch } from "@/lib/api-fetch";

interface Props {
  onSalvar: (f: Fornecedor) => void;
  onFechar: () => void;
}

const INPUT = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white";

export default function ModalNovoFornecedor({ onSalvar, onFechar }: Props) {
  const [salvando, setSalvando] = useState(false);
  const [dados, setDados] = useState({
    nomeFantasia: "",
    razaoSocial: "",
    cnpj: "",
    nomeContato: "",
    whatsapp: "",
  });

  function set(campo: string, valor: string) {
    setDados((prev) => ({ ...prev, [campo]: valor }));
  }

  async function salvar() {
    if (!dados.nomeFantasia.trim() && !dados.razaoSocial.trim()) {
      alert("Informe pelo menos o nome fantasia do fornecedor.");
      return;
    }
    setSalvando(true);
    try {
      const res = await apiFetch("/api/fornecedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...dados,
          id: Math.random().toString(36).substring(2, 10),
          inscricaoEstadual: "",
          emailCorporativo: "",
          categoria: "",
          produtos: "",
          pedidoMinimo: "",
          prazoEntregaDias: "",
          endereco: "",
          cidade: "",
          estado: "",
          condicoesPagamento: "",
          dadosBancarios: "",
          status: "Ativo",
          createdAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error();
      const f: Fornecedor = await res.json();
      onSalvar(f);
    } catch {
      alert("Erro ao cadastrar fornecedor.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onFechar}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Cadastrar Fornecedor</h2>
            <p className="text-xs text-gray-400 mt-0.5">Dados básicos — complete depois na página de fornecedores</p>
          </div>
          <button onClick={onFechar} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome Fantasia *</label>
            <input
              className={INPUT}
              value={dados.nomeFantasia}
              onChange={(e) => set("nomeFantasia", e.target.value)}
              placeholder="Ex: Gráfica Central"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Razão Social</label>
              <input className={INPUT} value={dados.razaoSocial} onChange={(e) => set("razaoSocial", e.target.value)} placeholder="Razão Social Ltda" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">CNPJ</label>
              <input className={INPUT} value={dados.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome do Contato</label>
              <input className={INPUT} value={dados.nomeContato} onChange={(e) => set("nomeContato", e.target.value)} placeholder="João Silva" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">WhatsApp</label>
              <input className={INPUT} value={dados.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(11) 99999-0000" />
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button onClick={onFechar} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex-1 py-2.5 rounded-xl bg-[#fb4d06] text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Cadastrar Fornecedor"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
