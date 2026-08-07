"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import FornecedorForm from "@/app/components/FornecedorForm";
import type { Fornecedor } from "@/app/types";
import { apiFetch } from "@/lib/api-fetch";

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function NovoFornecedor() {
  const router = useRouter();
  const { user } = useUser();
  const podeRestringir = user?.publicMetadata?.role === "admin" ||
    ((user?.publicMetadata?.permissoes as string[]) || []).includes("financeiro");
  const [dados, setDados] = useState<Partial<Fornecedor>>({
    status: "Ativo",
    restritoFinanceiro: false
  });
  const [salvando, setSalvando] = useState(false);

  function onChange(campo: keyof Fornecedor, valor: unknown) {
    setDados((prev) => ({ ...prev, [campo]: valor }));
  }

  async function salvar() {
    if (!dados.razaoSocial && !dados.nomeFantasia) {
      alert("Informe pelo menos a Razão Social ou Nome Fantasia.");
      return;
    }
    setSalvando(true);
    try {
      const res = await apiFetch("/api/fornecedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, id: gerarId(), createdAt: new Date().toISOString() }),
      });
      const salvo = await res.json();
      router.push(`/fornecedores/${salvo.id}`);
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
            <h1 className="text-2xl font-bold text-gray-800">Novo Fornecedor</h1>
            <p className="text-gray-500 text-sm">Preencha as informações do fornecedor.</p>
          </div>
          <button
            onClick={salvar}
            disabled={salvando}
            className="bg-[#fb4d06] text-white font-semibold py-2 px-6 rounded-xl hover:opacity-90 transition disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar Fornecedor"}
          </button>
        </div>

        <FornecedorForm dados={dados} onChange={onChange} showRestritoToggle={podeRestringir} />

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mt-5 flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-700">O upload de documentos ficará disponível após salvar o fornecedor.</p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={salvar}
            disabled={salvando}
            className="bg-[#fb4d06] text-white font-semibold py-3 px-10 rounded-xl hover:opacity-90 transition disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar Fornecedor →"}
          </button>
        </div>
      </main>
    </WorkspaceLayout>
  );
}
