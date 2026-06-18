"use client";

import { useEffect, useState } from "react";
import type { Produto, Fornecedor } from "@/app/types";
import ModalNovoFornecedor from "./ModalNovoFornecedor";
import ImagemReferencia from "./ImagemReferencia";

interface Props {
  nomeInicial?: string;
  onSalvar: (produto: Produto) => void;
  onFechar: () => void;
}

const INPUT = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white";

export default function ModalNovoProduto({ nomeInicial = "", onSalvar, onFechar }: Props) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [modalFornecedor, setModalFornecedor] = useState(false);
  const [imagemUrl, setImagemUrl] = useState<string | undefined>(undefined);
  const [dados, setDados] = useState({
    nome: nomeInicial,
    sku: "",
    marca: "",
    precoCusto: 0,
    fornecedorId: "",
    fornecedorNome: "",
    informacaoTecnica: "",
    status: "Ativo" as const,
    jaPersonalizado: false,
  });

  useEffect(() => {
    fetch("/api/fornecedores").then((r) => r.json()).then(setFornecedores);
  }, []);

  function set(campo: string, valor: unknown) {
    setDados((prev) => ({ ...prev, [campo]: valor }));
  }

  function handleNovoFornecedor(f: Fornecedor) {
    setFornecedores((prev) => [f, ...prev]);
    set("fornecedorId", f.id);
    set("fornecedorNome", f.nomeFantasia || f.razaoSocial);
    setModalFornecedor(false);
  }

  async function salvar() {
    if (!dados.nome.trim()) { alert("Nome do produto é obrigatório."); return; }
    setSalvando(true);
    try {
      const id = Math.random().toString(36).substring(2, 10);
      const res = await fetch("/api/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, imagemUrl, id, createdAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error();
      const produto: Produto = await res.json();
      onSalvar(produto);
    } catch {
      alert("Erro ao cadastrar produto.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
    {modalFornecedor && (
      <ModalNovoFornecedor
        onSalvar={handleNovoFornecedor}
        onFechar={() => setModalFornecedor(false)}
      />
    )}
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Cadastrar Produto</h2>
            <p className="text-xs text-gray-400 mt-0.5">O produto será salvo e aplicado ao item automaticamente</p>
          </div>
          <button onClick={onFechar} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Formulário */}
        <div className="p-6 flex flex-col gap-4">
          <div className="flex gap-4 items-start">
            <ImagemReferencia
              valor={imagemUrl}
              onChange={setImagemUrl}
              label="Foto do produto"
              width={120}
              height={88}
            />
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome do Produto *</label>
              <input
                className={INPUT}
                value={dados.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Ex: Boné Aba Curva"
                autoFocus
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">SKU / Código</label>
              <input className={INPUT} value={dados.sku} onChange={(e) => set("sku", e.target.value)} placeholder="Ex: BON-001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Marca</label>
              <input className={INPUT} value={dados.marca} onChange={(e) => set("marca", e.target.value)} placeholder="Ex: Pampa" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Preço de Custo (R$)</label>
              <input
                className={INPUT}
                type="number" min="0" step="0.01"
                value={dados.precoCusto || ""}
                onChange={(e) => set("precoCusto", parseFloat(e.target.value) || 0)}
                placeholder="0,00"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-500">Fornecedor</label>
                <button
                  type="button"
                  onClick={() => setModalFornecedor(true)}
                  className="text-[11px] font-semibold text-[#fb4d06] hover:underline"
                >
                  + Novo
                </button>
              </div>
              <select
                className={INPUT}
                value={dados.fornecedorId}
                onChange={(e) => {
                  const f = fornecedores.find((f) => f.id === e.target.value);
                  set("fornecedorId", e.target.value);
                  set("fornecedorNome", f ? (f.nomeFantasia || f.razaoSocial) : "");
                }}
              >
                <option value="">Selecionar...</option>
                {fornecedores.filter((f) => f.status === "Ativo").map((f) => (
                  <option key={f.id} value={f.id}>{f.nomeFantasia || f.razaoSocial}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Informação Técnica</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white resize-none"
              rows={3}
              value={dados.informacaoTecnica}
              onChange={(e) => set("informacaoTecnica", e.target.value)}
              placeholder="Material, dimensões, acabamento..."
            />
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={onFechar}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex-1 py-2.5 rounded-xl bg-[#fb4d06] text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar e Aplicar"}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
