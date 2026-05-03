"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import FornecedorForm from "@/app/components/FornecedorForm";
import DocumentosFornecedor from "@/app/components/DocumentosFornecedor";
import type { Fornecedor, DocumentoFornecedor } from "@/app/types";

export default function DetalheFornecedor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [dados, setDados] = useState<Fornecedor | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    fetch(`/api/fornecedores/${id}`)
      .then((r) => r.json())
      .then(setDados);
  }, [id]);

  function onChange(campo: keyof Fornecedor, valor: string) {
    setSalvo(false);
    setDados((prev) => prev ? { ...prev, [campo]: valor } : prev);
  }

  async function salvar() {
    if (!dados) return;
    setSalvando(true);
    try {
      await fetch(`/api/fornecedores/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      setSalvo(true);
    } catch {
      alert("Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function deletar() {
    if (!confirm("Excluir este fornecedor permanentemente?")) return;
    await fetch(`/api/fornecedores/${id}`, { method: "DELETE" });
    router.push("/fornecedores");
  }

  if (!dados) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>
  );

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{dados.nomeFantasia || dados.razaoSocial}</h1>
            <div className="flex items-center gap-2 mt-1">
              {dados.nomeFantasia && <p className="text-gray-400 text-sm">{dados.razaoSocial}</p>}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                dados.status === "Ativo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                {dados.status}
              </span>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {salvo && <span className="text-green-600 text-sm font-medium">✓ Salvo</span>}
            <button
              onClick={salvar}
              disabled={salvando}
              className="bg-green-600 text-white text-sm font-semibold py-2 px-5 rounded-xl hover:bg-green-700 transition disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
            <button onClick={deletar} className="text-sm text-red-400 hover:text-red-600 px-3 py-2">
              Excluir
            </button>
          </div>
        </div>

        <FornecedorForm dados={dados} onChange={onChange} />

        <div className="mt-5">
          <DocumentosFornecedor
            fornecedorId={id}
            documentos={dados.documentos || []}
            onUpdate={(docs: DocumentoFornecedor[]) => setDados((prev) => prev ? { ...prev, documentos: docs } : prev)}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={deletar} className="text-sm text-red-400 hover:text-red-600 px-4 py-2">
            Excluir fornecedor
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="bg-green-600 text-white font-semibold py-3 px-10 rounded-xl hover:bg-green-700 transition disabled:opacity-50"
          >
            {salvando ? "Salvando..." : salvo ? "✓ Salvo" : "Salvar alterações"}
          </button>
        </div>
      </main>
    </WorkspaceLayout>
  );
}
