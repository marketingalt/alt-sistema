"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Produto, Fornecedor } from "@/app/types";

interface Props {
  dados: Partial<Produto>;
  onChange: (campo: keyof Produto, valor: unknown) => void;
  produtoId?: string;
  onImagemAtualizada?: (url: string | undefined) => void;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

const INPUT = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white";

export default function ProdutoForm({ dados, onChange, produtoId, onImagemAtualizada }: Props) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const inputImgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/fornecedores").then((r) => r.json()).then(setFornecedores);
  }, []);

  function handleFornecedor(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const f = fornecedores.find((f) => f.id === id);
    onChange("fornecedorId", id);
    onChange("fornecedorNome", f ? (f.nomeFantasia || f.razaoSocial) : "");
  }

  async function enviarArquivo(arquivo: File) {
    if (!produtoId) return;
    if (!arquivo.type.startsWith("image/")) { alert("Envie apenas imagens (JPG, PNG ou WEBP)."); return; }
    setEnviandoImagem(true);
    try {
      const form = new FormData();
      form.append("imagem", arquivo);
      const res = await fetch(`/api/produtos/${produtoId}/imagem`, { method: "POST", body: form });
      if (!res.ok) throw new Error();
      const { imagemUrl } = await res.json();
      onChange("imagemUrl", imagemUrl);
      onImagemAtualizada?.(imagemUrl);
    } catch {
      alert("Erro ao enviar imagem.");
    } finally {
      setEnviandoImagem(false);
      if (inputImgRef.current) inputImgRef.current.value = "";
    }
  }

  function handleImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (arquivo) enviarArquivo(arquivo);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setArrastando(false);
    const arquivo = e.dataTransfer.files?.[0];
    if (arquivo) enviarArquivo(arquivo);
  }

  async function removerImagem() {
    if (!produtoId || !dados.imagemUrl) return;
    if (!confirm("Remover imagem do produto?")) return;
    await fetch(`/api/produtos/${produtoId}/imagem`, { method: "DELETE" });
    onChange("imagemUrl", undefined);
    onImagemAtualizada?.(undefined);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Imagem */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Imagem do Produto</h2>

        <input ref={inputImgRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" id="img-upload" onChange={handleImagem} />

        {produtoId ? (
          <label
            htmlFor="img-upload"
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={handleDrop}
            className={`block w-full rounded-2xl border-2 border-dashed transition cursor-pointer ${
              arrastando ? "border-purple-400 bg-[#fb4d06]/5" : "border-gray-200 bg-gray-50 hover:border-[#fb4d06]/30 hover:bg-[#fb4d06]/5"
            }`}
          >
            {dados.imagemUrl ? (
              <div className="relative">
                <div className="w-full h-52 rounded-2xl overflow-hidden">
                  <Image src={dados.imagemUrl.trim()} alt={dados.nome || "Produto"} width={600} height={208} className="object-contain w-full h-full" />
                </div>
                <div className="absolute inset-0 rounded-2xl bg-black/0 hover:bg-black/20 transition flex items-center justify-center opacity-0 hover:opacity-100">
                  <span className="text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-lg">
                    {enviandoImagem ? "Enviando..." : "Trocar imagem"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                {enviandoImagem ? (
                  <p className="text-sm text-[#fb4d06] font-medium">Enviando...</p>
                ) : (
                  <>
                    <svg className={`w-10 h-10 transition ${arrastando ? "text-purple-400" : "text-gray-300"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div className="text-center">
                      <p className={`text-sm font-medium transition ${arrastando ? "text-[#fb4d06]" : "text-gray-500"}`}>
                        {arrastando ? "Solte para adicionar" : "Arraste a imagem aqui ou clique para selecionar"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">JPG, PNG ou WEBP</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </label>
        ) : (
          <div className="w-full rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-10 gap-3">
            <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-xs text-gray-400">A imagem poderá ser adicionada após salvar o produto.</p>
          </div>
        )}

        {dados.imagemUrl && produtoId && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); removerImagem(); }}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Remover imagem
            </button>
          </div>
        )}
      </div>

      {/* Identificação */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Identificação</h2>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="SKU / Código do Produto *">
            <input className={INPUT} placeholder="Ex: BON-001" value={dados.sku || ""} onChange={(e) => onChange("sku", e.target.value)} />
          </Campo>
          <Campo label="Status">
            <div className="flex gap-2 mt-0.5">
              {(["Ativo", "Inativo"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange("status", s)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${
                    dados.status === s
                      ? s === "Ativo" ? "bg-green-600 text-white border-green-600" : "bg-gray-400 text-white border-gray-400"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Campo>
          <Campo label="Nome do Produto *">
            <input className={INPUT} placeholder="Ex: Boné Aba Curva" value={dados.nome || ""} onChange={(e) => onChange("nome", e.target.value)} />
          </Campo>
          <Campo label="Marca">
            <input className={INPUT} placeholder="Ex: Pampa" value={dados.marca || ""} onChange={(e) => onChange("marca", e.target.value)} />
          </Campo>
          <Campo label="Produto já vem personalizado?">
            <div className="flex gap-2 mt-0.5">
              {([true, false] as const).map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => onChange("jaPersonalizado", val)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${
                    dados.jaPersonalizado === val
                      ? val ? "bg-[#fb4d06] text-white border-purple-600" : "bg-gray-200 text-gray-700 border-gray-200"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {val ? "Sim" : "Não"}
                </button>
              ))}
            </div>
          </Campo>
        </div>
      </div>

      {/* Preço e Fornecedor */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Preço e Fornecedor</h2>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Preço de Custo (R$) *">
            <input
              className={INPUT}
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={dados.precoCusto ?? ""}
              onChange={(e) => onChange("precoCusto", parseFloat(e.target.value) || 0)}
            />
          </Campo>
          <Campo label="Fornecedor">
            <select
              className={INPUT}
              value={dados.fornecedorId || ""}
              onChange={handleFornecedor}
            >
              <option value="">Selecionar fornecedor...</option>
              {fornecedores.filter((f) => f.status === "Ativo").map((f) => (
                <option key={f.id} value={f.id}>{f.nomeFantasia || f.razaoSocial}</option>
              ))}
            </select>
          </Campo>
        </div>
      </div>

      {/* Informação Técnica */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Informação Técnica</h2>
        <Campo label="Especificações, materiais, dimensões, acabamentos...">
          <textarea
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white resize-none"
            rows={5}
            placeholder="Ex: Material: algodão 100% penteado, 180g/m². Tamanhos: P, M, G, GG. Personalização por bordado ou silk. Entrega em 15 dias úteis após aprovação da arte."
            value={dados.informacaoTecnica || ""}
            onChange={(e) => onChange("informacaoTecnica", e.target.value)}
          />
        </Campo>
      </div>
    </div>
  );
}
