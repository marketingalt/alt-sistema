"use client";

import { useRef, useState } from "react";
import type { DocumentoFornecedor } from "@/app/types";

const TIPOS_ACEITOS = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip";

function iconeArquivo(tipo: string) {
  if (tipo.includes("pdf")) return "📄";
  if (tipo.includes("image")) return "🖼️";
  if (tipo.includes("word") || tipo.includes("document")) return "📝";
  if (tipo.includes("sheet") || tipo.includes("excel")) return "📊";
  if (tipo.includes("zip")) return "🗜️";
  return "📎";
}

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface Props {
  fornecedorId: string;
  documentos: DocumentoFornecedor[];
  onUpdate: (docs: DocumentoFornecedor[]) => void;
  baseUrl?: string; // permite usar /api/clientes/:id/documentos também
}

const CATEGORIAS_DOC = [
  "Cartão CNPJ",
  "Contrato de Fornecimento",
  "Tabela de Preços",
  "Catálogo de Produtos",
  "Inscrição Estadual",
  "Comprovante Bancário",
  "NF / Nota Fiscal",
  "Outro",
];

export default function DocumentosFornecedor({ fornecedorId, documentos, onUpdate, baseUrl }: Props) {
  const apiBase = baseUrl || `/api/fornecedores/${fornecedorId}/documentos`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [nomeCustom, setNomeCustom] = useState("");
  const [categoria, setCategoria] = useState("Outro");
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setArquivoSelecionado(f);
    setNomeCustom(f.name.replace(/\.[^.]+$/, ""));
  }

  async function enviar() {
    if (!arquivoSelecionado) return;
    setEnviando(true);
    try {
      const form = new FormData();
      // Renomeia com categoria se quiser
      const nomeDisplay = nomeCustom.trim() || arquivoSelecionado.name;
      const ext = arquivoSelecionado.name.includes(".") ? "." + arquivoSelecionado.name.split(".").pop() : "";
      const arquivoFinal = new File([arquivoSelecionado], `${nomeDisplay}${ext}`, { type: arquivoSelecionado.type });
      form.append("arquivo", arquivoFinal);

      const res = await fetch(apiBase, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error();
      const novo: DocumentoFornecedor = await res.json();
      onUpdate([...documentos, novo]);
      setArquivoSelecionado(null);
      setNomeCustom("");
      setCategoria("Outro");
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      alert("Erro ao enviar documento.");
    } finally {
      setEnviando(false);
    }
  }

  async function excluir(docId: string) {
    if (!confirm("Excluir este documento?")) return;
    await fetch(`${apiBase}/${docId}`, { method: "DELETE" });
    onUpdate(documentos.filter((d) => d.id !== docId));
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Documentos do Fornecedor
      </h2>

      {/* Upload */}
      <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-5 mb-5">
        <p className="text-xs font-medium text-gray-500 mb-3">Adicionar documento</p>

        <input
          ref={inputRef}
          type="file"
          accept={TIPOS_ACEITOS}
          className="hidden"
          id="doc-upload"
          onChange={handleArquivo}
        />

        {!arquivoSelecionado ? (
          <label
            htmlFor="doc-upload"
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center group-hover:border-[#fb4d06]/30 transition">
              <svg className="w-5 h-5 text-gray-400 group-hover:text-[#fb4d06]/80 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 group-hover:text-[#fb4d06] transition">Clique para selecionar</p>
              <p className="text-xs text-gray-400">PDF, Word, Excel, imagem ou ZIP</p>
            </div>
          </label>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-200">
              <span className="text-lg">{iconeArquivo(arquivoSelecionado.type)}</span>
              <span className="text-sm text-gray-700 flex-1 truncate">{arquivoSelecionado.name}</span>
              <span className="text-xs text-gray-400">{formatarTamanho(arquivoSelecionado.size)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome do documento</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={nomeCustom}
                  onChange={(e) => setNomeCustom(e.target.value)}
                  placeholder="Nome para identificar"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Categoria</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                >
                  {CATEGORIAS_DOC.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={enviar}
                disabled={enviando}
                className="flex-1 bg-[#fb4d06] text-white text-sm font-semibold py-2 rounded-lg hover:bg-[#e04405] transition disabled:opacity-50"
              >
                {enviando ? "Enviando..." : "Confirmar upload"}
              </button>
              <button
                onClick={() => { setArquivoSelecionado(null); setNomeCustom(""); if (inputRef.current) inputRef.current.value = ""; }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de documentos */}
      {documentos.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Nenhum documento cadastrado ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {documentos.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition">
              <span className="text-xl shrink-0">{iconeArquivo(doc.tipo)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{doc.nome}</p>
                <p className="text-xs text-gray-400">
                  {formatarTamanho(doc.tamanho)} · {formatarData(doc.uploadedAt)}
                  {doc.uploadedBy ? ` · ${doc.uploadedBy}` : ""}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <a
                  href={`${apiBase}/${doc.id}`}
                  download={doc.nome}
                  className="flex items-center gap-1 text-xs text-[#fb4d06] hover:text-[#fb4d06] bg-[#fb4d06]/5 hover:bg-[#fb4d06]/10 px-2.5 py-1.5 rounded-lg transition font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Baixar
                </a>
                <button
                  onClick={() => excluir(doc.id)}
                  className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition"
                  title="Excluir documento"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
