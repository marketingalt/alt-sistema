"use client";

import { useRef, useState } from "react";
import type { DocumentoFornecedor } from "@/app/types";

function formatarTamanho(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  orcamentoId: string;
  documentos: DocumentoFornecedor[];
  onUpdate: (docs: DocumentoFornecedor[]) => void;
}

export default function PedidoComprasAnexo({ orcamentoId, documentos, onUpdate }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  const apiBase = `/api/orcamentos/${orcamentoId}/documentos`;

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviando(true);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      const res = await fetch(apiBase, { method: "POST", body: form });
      if (!res.ok) throw new Error();
      const novo: DocumentoFornecedor = await res.json();
      onUpdate([...documentos, novo]);
    } catch {
      alert("Erro ao enviar documento.");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function excluir(docId: string) {
    if (!confirm("Remover este documento?")) return;
    await fetch(`${apiBase}/${docId}`, { method: "DELETE" });
    onUpdate(documentos.filter((d) => d.id !== docId));
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">PO:</span>

      {documentos.length === 0 ? (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            id="pc-upload"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={handleArquivo}
            disabled={enviando}
          />
          <label
            htmlFor="pc-upload"
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-[#fb4d06]/50 hover:text-[#fb4d06] cursor-pointer transition ${enviando ? "opacity-50 pointer-events-none" : ""}`}
          >
            {enviando ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Enviando...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Anexar documento
              </>
            )}
          </label>
        </>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {documentos.map((doc) => (
            <div
              key={doc.id}
              className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-lg"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate max-w-[160px]" title={doc.nome}>{doc.nome}</span>
              <span className="text-blue-400 text-[10px]">({formatarTamanho(doc.tamanho)})</span>
              <a
                href={`${apiBase}/${doc.id}`}
                download={doc.nome}
                className="ml-1 text-blue-500 hover:text-blue-700 transition"
                title="Baixar"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
              <button
                onClick={() => excluir(doc.id)}
                className="ml-0.5 text-blue-400 hover:text-red-500 transition"
                title="Remover"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {/* Permitir adicionar mais documentos */}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            id="pc-upload-extra"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={handleArquivo}
            disabled={enviando}
          />
          <label
            htmlFor="pc-upload-extra"
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#fb4d06] cursor-pointer transition px-2 py-1.5"
            title="Adicionar outro documento"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </label>
        </div>
      )}
    </div>
  );
}
