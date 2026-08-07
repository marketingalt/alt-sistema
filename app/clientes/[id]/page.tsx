"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import ClienteForm from "@/app/components/ClienteForm";
import DocumentosFornecedor from "@/app/components/DocumentosFornecedor";
import type { Cliente, DocumentoFornecedor, Orcamento } from "@/app/types";
import { STATUS_CONFIG } from "@/app/types";
import { apiFetch } from "@/lib/api-fetch";

const STATUS_CORES: Record<string, string> = {
  "Ativo": "bg-green-100 text-green-700",
  "Inativo": "bg-gray-100 text-gray-500",
  "Inadimplente": "bg-red-100 text-red-700",
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function totalOrcamento(o: Orcamento) {
  return o.itens.reduce((a, i) => a + (i.total || 0), 0);
}

export default function DetalheCliente() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const podeRestringir = user?.publicMetadata?.role === "admin" ||
    ((user?.publicMetadata?.permissoes as string[]) || []).includes("financeiro");
  const [dados, setDados] = useState<Cliente | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [projetos, setProjetos] = useState<Orcamento[]>([]);

  useEffect(() => {
    apiFetch(`/api/clientes/${id}`).then((r) => r.json()).then(setDados);
    apiFetch("/api/orcamentos")
      .then((r) => r.json())
      .then((lista: Orcamento[]) => setProjetos(lista.filter((o) => o.clienteId === id)));
  }, [id]);

  function onChange(campo: keyof Cliente, valor: unknown) {
    setSalvo(false);
    setDados((prev) => prev ? { ...prev, [campo]: valor } : prev);
  }

  async function salvar() {
    if (!dados) return;
    setSalvando(true);
    try {
      await apiFetch(`/api/clientes/${id}`, {
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
    await apiFetch(`/api/clientes/${id}`, { method: "DELETE" });
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
              {dados.restritoFinanceiro && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
                  🔒 Financeiro
                </span>
              )}
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
          </div>

          {/* Audit trail */}
          {(dados.userName || dados.updatedBy) && (
            <p className="text-xs text-gray-400 mb-6">
              👤 Criado por {dados.userName || "—"} · {dados.createdAt ? new Date(dados.createdAt).toLocaleDateString("pt-BR") : "—"}
              {dados.updatedBy && <> · ✏️ Última alteração por {dados.updatedBy} · {dados.updatedAt ? new Date(dados.updatedAt).toLocaleString("pt-BR") : "—"}</>}
            </p>
          )}

        <ClienteForm dados={dados} onChange={onChange} showRestritoToggle={podeRestringir} />

        {/* Projetos / Jobs vinculados */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Projetos / Jobs ({projetos.length})
            </h2>
            <Link href="/novo">
              <button className="text-xs font-semibold text-[#fb4d06] hover:underline">+ Novo orçamento</button>
            </Link>
          </div>

          {projetos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum orçamento vinculado a este cliente ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {projetos.map((o) => {
                const cfg = STATUS_CONFIG[o.status || "Em andamento"];
                const total = totalOrcamento(o);
                return (
                  <Link key={o.id} href={`/orcamentos/${o.id}`}>
                    <div className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-gray-50 transition cursor-pointer border border-transparent hover:border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-[#fb4d06] bg-[#fb4d06]/5 px-2 py-0.5 rounded-full whitespace-nowrap">
                          #{o.numero}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {o.nomeProjeto || o.cliente || "Sem nome"}
                          </p>
                          <p className="text-xs text-gray-400">{o.dataOrcamento}{o.responsavel ? ` · ${o.responsavel}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.cor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {o.status || "Em andamento"}
                        </span>
                        <span className="text-sm font-bold text-[#fb4d06] whitespace-nowrap">{fmt(total)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

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
