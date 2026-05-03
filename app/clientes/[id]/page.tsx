"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import ClienteForm from "@/app/components/ClienteForm";
import DocumentosFornecedor from "@/app/components/DocumentosFornecedor";
import type { Cliente, DocumentoFornecedor } from "@/app/types";

const STATUS_CORES: Record<string, string> = {
  "Ativo": "bg-green-100 text-green-700",
  "Inativo": "bg-gray-100 text-gray-500",
  "Inadimplente": "bg-red-100 text-red-700",
};

export default function DetalheCliente() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [dados, setDados] = useState<Cliente | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    fetch(`/api/clientes/${id}`).then((r) => r.json()).then(setDados);
  }, [id]);

  function onChange(campo: keyof Cliente, valor: unknown) {
    setSalvo(false);
    setDados((prev) => prev ? { ...prev, [campo]: valor } : prev);
  }

  async function salvar() {
    if (!dados) return;
    setSalvando(true);
    try {
      await fetch(`/api/clientes/${id}`, {
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
    if (!confirm("Excluir este cliente permanentemente?")) return;
    await fetch(`/api/clientes/${id}`, { method: "DELETE" });
    router.push("/clientes");
  }

  if (!dados) return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>;

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{dados.nomeEmpresa || dados.razaoSocial}</h1>
            <div className="flex items-center gap-2 mt-1">
              {dados.nomeEmpresa && dados.razaoSocial && <p className="text-gray-400 text-sm">{dados.razaoSocial}</p>}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CORES[dados.status || "Ativo"]}`}>
                {dados.status || "Ativo"}
              </span>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {salvo && <span className="text-green-600 text-sm font-medium">✓ Salvo</span>}
            <button onClick={salvar} disabled={salvando}
              className="bg-green-600 text-white text-sm font-semibold py-2 px-5 rounded-xl hover:bg-green-700 transition disabled:opacity-50">
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
            <button onClick={deletar} className="text-sm text-red-400 hover:text-red-600 px-3 py-2">Excluir</button>
          </div>
        </div>

        <ClienteForm dados={dados} onChange={onChange} />

        <div className="mt-5">
          <DocumentosFornecedor
            fornecedorId={id}
            documentos={dados.documentos || []}
            baseUrl={`/api/clientes/${id}/documentos`}
            onUpdate={(docs: DocumentoFornecedor[]) => setDados((prev) => prev ? { ...prev, documentos: docs } : prev)}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={deletar} className="text-sm text-red-400 hover:text-red-600 px-4 py-2">Excluir cliente</button>
          <button onClick={salvar} disabled={salvando}
            className="bg-green-600 text-white font-semibold py-3 px-10 rounded-xl hover:bg-green-700 transition disabled:opacity-50">
            {salvando ? "Salvando..." : salvo ? "✓ Salvo" : "Salvar alterações"}
          </button>
        </div>
      </main>
    </WorkspaceLayout>
  );
}
