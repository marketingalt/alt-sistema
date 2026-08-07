"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import ClienteForm from "@/app/components/ClienteForm";
import DocumentosFornecedor from "@/app/components/DocumentosFornecedor";
import type { Cliente, DocumentoFornecedor } from "@/app/types";
import { apiFetch } from "@/lib/api-fetch";

function gerarId() { return Math.random().toString(36).substring(2, 10); }

export default function NovoCliente() {
  const router = useRouter();
  const { user } = useUser();
  const podeRestringir = user?.publicMetadata?.role === "admin" ||
    ((user?.publicMetadata?.permissoes as string[]) || []).includes("financeiro");
  const [id] = useState(() => gerarId());
  const [dados, setDados] = useState<Partial<Cliente>>({
    status: "Ativo",
    restritoFinanceiro: false,
    mesmoContatoFinanceiro: true,
    formasPagamento: [],
    documentos: [],
  });
  const [salvando, setSalvando] = useState(false);

  function onChange(campo: keyof Cliente, valor: unknown) {
    setDados((prev) => ({ ...prev, [campo]: valor }));
  }

  async function salvar() {
    if (!dados.nomeEmpresa && !dados.razaoSocial) {
      alert("Informe pelo menos o Nome da Empresa ou Razão Social.");
      return;
    }
    setSalvando(true);
    try {
      const res = await apiFetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, id, createdAt: new Date().toISOString() }),
      });
      const salvo = await res.json();
      router.push(`/clientes/${salvo.id}`);
    } catch {
      alert("Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Novo Cliente</h1>
            <p className="text-gray-500 text-sm">Preencha as informações do cliente.</p>
          </div>
          <button onClick={salvar} disabled={salvando}
            className="bg-[#fb4d06] text-white font-semibold py-2 px-6 rounded-xl hover:opacity-90 transition disabled:opacity-50">
            {salvando ? "Salvando..." : "Salvar Cliente"}
          </button>
        </div>

        <ClienteForm dados={dados} onChange={onChange} showRestritoToggle={podeRestringir} />

        <div className="mt-5">
          <DocumentosFornecedor
            fornecedorId={id}
            documentos={dados.documentos || []}
            baseUrl={`/api/clientes/${id}/documentos`}
            onUpdate={(docs: DocumentoFornecedor[]) => setDados((prev) => ({ ...prev, documentos: docs }))}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={salvar} disabled={salvando}
            className="bg-[#fb4d06] text-white font-semibold py-3 px-10 rounded-xl hover:opacity-90 transition disabled:opacity-50">
            {salvando ? "Salvando..." : "Salvar Cliente →"}
          </button>
        </div>
      </main>
    </WorkspaceLayout>
  );
}
