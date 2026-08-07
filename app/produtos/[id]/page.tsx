"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import ProdutoForm from "@/app/components/ProdutoForm";
import type { Produto } from "@/app/types";
import { apiFetch } from "@/lib/api-fetch";

export default function DetalheProduto() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [dados, setDados] = useState<Produto | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    apiFetch(`/api/produtos/${id}`).then((r) => r.json()).then(setDados);
  }, [id]);

  function onChange(campo: keyof Produto, valor: unknown) {
    setSalvo(false);
    setDados((prev) => prev ? { ...prev, [campo]: valor } : prev);
  }

  async function salvar() {
    if (!dados) return;
    setSalvando(true);
    try {
      await apiFetch(`/api/produtos/${id}`, {
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
    if (!confirm("Excluir este produto permanentemente?")) return;
    await apiFetch(`/api/produtos/${id}`, { method: "DELETE" });
    router.push("/produtos");
  }

  if (!dados) return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>;

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{dados.nome}</h1>
            <p className="text-gray-400 text-sm">SKU: {dados.sku}{dados.marca ? ` · ${dados.marca}` : ""}</p>
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

        {/* Audit trail */}
        {(dados.userName || dados.updatedBy) && (
          <p className="text-xs text-gray-400 mb-6">
            👤 Criado por {dados.userName || "—"} · {dados.createdAt ? new Date(dados.createdAt).toLocaleDateString("pt-BR") : "—"}
            {dados.updatedBy && <> · ✏️ Última alteração por {dados.updatedBy} · {dados.updatedAt ? new Date(dados.updatedAt).toLocaleString("pt-BR") : "—"}</>}
          </p>
        )}

        <ProdutoForm
          dados={dados}
          onChange={onChange}
          produtoId={id}
          onImagemAtualizada={(url) => setDados((prev) => prev ? { ...prev, imagemUrl: url } : prev)}
        />

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={deletar} className="text-sm text-red-400 hover:text-red-600 px-4 py-2">Excluir produto</button>
          <button onClick={salvar} disabled={salvando}
            className="bg-green-600 text-white font-semibold py-3 px-10 rounded-xl hover:bg-green-700 transition disabled:opacity-50">
            {salvando ? "Salvando..." : salvo ? "✓ Salvo" : "Salvar alterações"}
          </button>
        </div>
      </main>
    </WorkspaceLayout>
  );
}
