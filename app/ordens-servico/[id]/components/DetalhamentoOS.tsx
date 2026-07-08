"use client";

import { useState, useRef } from "react";
import type { OrdemServico, CampoDinamicoDef, DocumentoFornecedor } from "@/app/types";
import CampoDinamicoRenderer from "./CampoDinamicoRenderer";

interface Props {
  os: OrdemServico;
  camposDinamicos: CampoDinamicoDef[];
  onUpdateOS: (updates: Partial<OrdemServico>) => void;
  osId: string;
}

export default function DetalhamentoOS({ os, camposDinamicos, onUpdateOS, osId }: Props) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Filtra campos por grupo ──────────────────────────
  const camposDetalhamento = camposDinamicos.filter(
    (c) => c.grupo === "detalhamento" && !c.itemVinculado
  );
  const camposChecklist = camposDinamicos.filter((c) => c.grupo === "checklist");

  // ── Valor de campo dinâmico ──────────────────────────
  function getValor(campoId: string) {
    return os.camposDinamicos?.[campoId] ?? "";
  }

  function setValor(campoId: string, valor: any) {
    onUpdateOS({
      camposDinamicos: { ...(os.camposDinamicos || {}), [campoId]: valor },
    });
  }

  // ── Upload ───────────────────────────────────────────
  async function handleUpload(file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("arquivo", file);
      const res = await fetch(`/api/ordens-servico/${osId}/documentos`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      const doc: DocumentoFornecedor = await res.json();
      onUpdateOS({
        documentos: [...(os.documentos || []), doc],
      });
    } catch (err) {
      console.error("[UPLOAD ERROR]", err);
      alert("Erro ao fazer upload do arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (!confirm("Excluir este documento?")) return;
    try {
      const res = await fetch(
        `/api/ordens-servico/${osId}/documentos/${docId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      onUpdateOS({
        documentos: (os.documentos || []).filter((d) => d.id !== docId),
      });
    } catch (err) {
      console.error("[DELETE DOC ERROR]", err);
      alert("Erro ao excluir documento.");
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── Dados de condições do item ──────────────────────
  function ItemConditionsCard({ item }: { item: OrdemServico["itens"][0] }) {
    const camposItem = camposDinamicos.filter(
      (c) => c.grupo === "detalhamento" && c.itemVinculado
    );
    return (
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">
          {item.item}
          {item.kit && <span className="text-xs text-gray-400 ml-1.5 font-normal">({item.kit})</span>}
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-gray-500">Qtd:</span>{" "}
            <span className="font-medium text-gray-800">{item.quantidade}</span>
          </div>
          {item.fornecedorNome && (
            <div>
              <span className="text-gray-500">Fornecedor:</span>{" "}
              <span className="font-medium text-gray-800 truncate block">{item.fornecedorNome}</span>
            </div>
          )}
          <div>
            <span className="text-gray-500">Custo unit.:</span>{" "}
            <span className="font-medium text-gray-800">
              {item.custoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Total custo:</span>{" "}
            <span className="font-medium text-gray-800">
              {item.totalCusto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
          {item.custoPersonalizacao > 0 && (
            <div>
              <span className="text-gray-500">Personalização:</span>{" "}
              <span className="font-medium text-gray-800">
                {item.custoPersonalizacao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          )}
          {item.freteProducao > 0 && (
            <div>
              <span className="text-gray-500">Frete:</span>{" "}
              <span className="font-medium text-gray-800">
                {item.freteProducao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          )}
        </div>

        {/* Campos vinculados ao item */}
        {camposItem.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-200">
            {camposItem.map((campo) => (
              <CampoDinamicoRenderer
                key={campo.id}
                campo={campo}
                valor={getValor(campo.id)}
                onChange={(v) => setValor(campo.id, v)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
      <h2 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-3">
        Detalhamento Técnico
      </h2>

      {/* Itens do orçamento com condições */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Itens da OS</h3>
        {os.itens.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nenhum item vinculado.</p>
        ) : (
          os.itens.map((item, idx) => <ItemConditionsCard key={idx} item={item} />)
        )}
      </div>

      {/* Campos dinâmicos — Detalhamento */}
      {camposDetalhamento.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Informações Complementares
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {camposDetalhamento.map((campo) => (
              <CampoDinamicoRenderer
                key={campo.id}
                campo={campo}
                valor={getValor(campo.id)}
                onChange={(v) => setValor(campo.id, v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Checklist */}
      {camposChecklist.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Checklist de Conferência
          </h3>
          <div className="space-y-2">
            {camposChecklist.map((campo) => (
              <CampoDinamicoRenderer
                key={campo.id}
                campo={campo}
                valor={getValor(campo.id)}
                onChange={(v) => setValor(campo.id, v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Anexos / Documentos */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Anexos</h3>

        {/* Lista de docs */}
        {os.documentos && os.documentos.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {os.documentos.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <a
                    href={`/api/ordens-servico/${osId}/documentos/${doc.id}?inline=1`}
                    target="_blank"
                    className="text-sm text-[#fb4d06] hover:underline truncate"
                  >
                    {doc.nome}
                  </a>
                  <span className="text-xs text-gray-400 shrink-0">{formatSize(doc.tamanho)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`/api/ordens-servico/${osId}/documentos/${doc.id}`}
                    download={doc.nome}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    title="Baixar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </a>
                  <button
                    onClick={() => handleDeleteDoc(doc.id)}
                    className="text-gray-400 hover:text-red-500 p-1"
                    title="Excluir"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 text-sm font-medium text-[#fb4d06] hover:opacity-80 transition disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {uploading ? "Enviando..." : "Adicionar anexo"}
          </button>
        </div>
      </div>
    </div>
  );
}
