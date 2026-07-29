"use client";

import { useEffect, useRef, useState } from "react";

interface AnexoTarefa {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  uploadedAt: string;
  uploadedBy?: string;
}

function iconeArquivo(tipo: string) {
  if (tipo.includes("pdf")) return "📄";
  if (tipo.includes("image")) return "🖼️";
  if (tipo.includes("word") || tipo.includes("document")) return "📝";
  if (tipo.includes("sheet") || tipo.includes("excel")) return "📊";
  return "📎";
}

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AnexosTarefaPlanejamento({ tarefaId }: { tarefaId: string }) {
  const [anexos, setAnexos] = useState<AnexoTarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const apiBase = `/api/planejamento/tarefas/${tarefaId}/anexos`;

  useEffect(() => {
    setCarregando(true);
    fetch(apiBase)
      .then((r) => (r.ok ? r.json() : []))
      .then(setAnexos)
      .catch(() => setAnexos([]))
      .finally(() => setCarregando(false));
  }, [apiBase]);

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviando(true);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      const res = await fetch(apiBase, { method: "POST", body: form });
      if (res.ok) {
        const novo: AnexoTarefa = await res.json();
        setAnexos((prev) => [...prev, novo]);
      } else {
        const err = await res.json().catch(() => ({ error: "Erro ao enviar anexo" }));
        alert(err.error || "Erro ao enviar anexo");
      }
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function excluir(anexoId: string) {
    if (!confirm("Remover este anexo?")) return;
    await fetch(`${apiBase}/${anexoId}`, { method: "DELETE" });
    setAnexos((prev) => prev.filter((a) => a.id !== anexoId));
  }

  return (
    <div className="mb-6">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Anexos</label>

      {carregando ? (
        <p className="text-xs text-gray-400">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-2 mb-2">
          {anexos.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <span className="text-base shrink-0">{iconeArquivo(doc.tipo)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{doc.nome}</p>
                <p className="text-[10px] text-gray-400">{formatarTamanho(doc.tamanho)}</p>
              </div>
              <a
                href={`${apiBase}/${doc.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#fb4d06] hover:underline px-1.5"
              >
                Abrir
              </a>
              <button
                onClick={() => excluir(doc.id)}
                className="text-[11px] text-red-400 hover:text-red-600 px-1"
                title="Remover anexo"
              >
                ✕
              </button>
            </div>
          ))}
          {anexos.length === 0 && <p className="text-xs text-gray-400">Nenhum anexo ainda.</p>}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        id={`anexo-tarefa-${tarefaId}`}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
        onChange={handleArquivo}
        disabled={enviando}
      />
      <label
        htmlFor={`anexo-tarefa-${tarefaId}`}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-[#fb4d06]/50 hover:text-[#fb4d06] cursor-pointer transition ${enviando ? "opacity-50 pointer-events-none" : ""}`}
      >
        {enviando ? "Enviando..." : "+ Adicionar anexo"}
      </label>
    </div>
  );
}
