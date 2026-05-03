"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import ProdutoForm from "@/app/components/ProdutoForm";
import type { Produto } from "@/app/types";

function gerarId() { return Math.random().toString(36).substring(2, 10); }

export default function NovoProduto() {
  const router = useRouter();
  const [id] = useState(() => gerarId());
  const [dados, setDados] = useState<Partial<Produto>>({ status: "Ativo", jaPersonalizado: false });
  const [salvando, setSalvando] = useState(false);

  function onChange(campo: keyof Produto, valor: unknown) {
    setDados((prev) => ({ ...prev, [campo]: valor }));
  }

  async function salvar() {
    if (!dados.sku) { alert("Informe o SKU do produto."); return; }
    if (!dados.nome) { alert("Informe o nome do produto."); return; }
    setSalvando(true);
    try {
      const res = await fetch("/api/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, id, createdAt: new Date().toISOString() }),
      });
      const salvo = await res.json();
      router.push(`/produtos/${salvo.id}`);
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
            <h1 className="text-2xl font-bold text-gray-800">Novo Produto</h1>
            <p className="text-gray-500 text-sm">Preencha as informações do produto.</p>
          </div>
          <button onClick={salvar} disabled={salvando}
            className="bg-[#fb4d06] text-white font-semibold py-2 px-6 rounded-xl hover:opacity-90 transition disabled:opacity-50">
            {salvando ? "Salvando..." : "Salvar Produto"}
          </button>
        </div>

        <ProdutoForm
          dados={dados}
          onChange={onChange}
          produtoId={id}
          onImagemAtualizada={(url) => setDados((prev) => ({ ...prev, imagemUrl: url }))}
        />

        <div className="mt-6 flex justify-end">
          <button onClick={salvar} disabled={salvando}
            className="bg-[#fb4d06] text-white font-semibold py-3 px-10 rounded-xl hover:opacity-90 transition disabled:opacity-50">
            {salvando ? "Salvando..." : "Salvar Produto →"}
          </button>
        </div>
      </main>
    </WorkspaceLayout>
  );
}
