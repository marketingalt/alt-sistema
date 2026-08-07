"use client";

import { useState } from "react";
import type { Cliente } from "@/app/types";
import { apiFetch } from "@/lib/api-fetch";

interface Props {
  onSalvar: (cliente: Cliente) => void;
  onFechar: () => void;
}

const INPUT = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white";

export default function ModalNovoCliente({ onSalvar, onFechar }: Props) {
  const [salvando, setSalvando] = useState(false);
  const [dados, setDados] = useState({
    nomeEmpresa: "",
    razaoSocial: "",
    cnpj: "",
    nomeContato: "",
    emailContato: "",
    whatsappContato: "",
    status: "Ativo" as const,
  });

  function set(campo: string, valor: string) {
    setDados((prev) => ({ ...prev, [campo]: valor }));
  }

  async function salvar() {
    if (!dados.nomeEmpresa.trim() && !dados.razaoSocial.trim()) {
      alert("Informe o nome da empresa.");
      return;
    }
    setSalvando(true);
    try {
      const id = Math.random().toString(36).substring(2, 10);
      const res = await apiFetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          ...dados,
          razaoSocial: dados.razaoSocial || dados.nomeEmpresa,
          inscricaoEstadual: "",
          nomeContatoFinanceiro: "",
          emailContatoFinanceiro: "",
          whatsappContatoFinanceiro: "",
          mesmoContatoFinanceiro: true,
          endereco: "", bairro: "", cidade: "", estado: "", cep: "",
          formasPagamento: [],
          solicitantes: [],
          createdAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error();
      const cliente: Cliente = await res.json();
      onSalvar(cliente);
    } catch {
      alert("Erro ao cadastrar cliente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Novo Cliente</h2>
            <p className="text-xs text-gray-400 mt-0.5">Cadastro rápido — complete os detalhes depois</p>
          </div>
          <button onClick={onFechar} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome da Empresa *</label>
              <input className={INPUT} value={dados.nomeEmpresa} onChange={(e) => set("nomeEmpresa", e.target.value)} placeholder="Ex: ACME Ltda" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Razão Social</label>
              <input className={INPUT} value={dados.razaoSocial} onChange={(e) => set("razaoSocial", e.target.value)} placeholder="Igual ao nome ou diferente" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">CNPJ</label>
              <input className={INPUT} value={dados.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome do Contato</label>
              <input className={INPUT} value={dados.nomeContato} onChange={(e) => set("nomeContato", e.target.value)} placeholder="Nome do responsável" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">WhatsApp</label>
              <input className={INPUT} value={dados.whatsappContato} onChange={(e) => set("whatsappContato", e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
              <input className={INPUT} type="email" value={dados.emailContato} onChange={(e) => set("emailContato", e.target.value)} placeholder="contato@empresa.com" />
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button onClick={onFechar} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando} className="flex-1 py-2.5 rounded-xl bg-[#fb4d06] text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
              {salvando ? "Salvando..." : "Salvar Cliente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
