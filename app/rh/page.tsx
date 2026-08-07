"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import { apiFetch } from "@/lib/api-fetch";

interface ClerkUser {
  id: string;
  nome: string;
  email: string;
  imagemUrl?: string;
}

interface DocumentoRH {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  uploadedAt: string;
  uploadedBy: string;
  categoria: string;
}

const CATEGORIAS = [
  { key: "contrato", label: "Contrato", cor: "text-blue-600 bg-blue-50 border-blue-200" },
  { key: "ficha", label: "Ficha Cadastro", cor: "text-purple-600 bg-purple-50 border-purple-200" },
  { key: "doc pessoal", label: "Documento Pessoal", cor: "text-amber-600 bg-amber-50 border-amber-200" },
  { key: "outro", label: "Outro", cor: "text-gray-600 bg-gray-50 border-gray-200" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RhPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [usuarios, setUsuarios] = useState<ClerkUser[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<ClerkUser | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoRH[]>([]);
  const [carregandoDocs, setCarregandoDocs] = useState(false);
  const [categoria, setCategoria] = useState("contrato");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { router.replace("/sign-in"); return; }
    carregarUsuarios();
  }, [isLoaded]);

  async function carregarUsuarios() {
    try {
      const res = await apiFetch("/api/admin/usuarios");
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data);
      }
    } catch {} finally {
      setCarregando(false);
    }
  }

  async function selecionarUsuario(u: ClerkUser) {
    setUsuarioSelecionado(u);
    setCarregandoDocs(true);
    try {
      const res = await apiFetch(`/api/rh/documentos?email=${encodeURIComponent(u.email)}`);
      if (res.ok) {
        const data = await res.json();
        setDocumentos(data.documentos || []);
      }
    } catch {} finally {
      setCarregandoDocs(false);
    }
  }

  async function uploadDocumento(file: File) {
    if (!usuarioSelecionado) return;
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", file);
      formData.append("email", usuarioSelecionado.email);
      formData.append("categoria", categoria);

      const res = await apiFetch("/api/rh/documentos", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const doc = await res.json();
        setDocumentos((prev) => [...prev, doc]);
      } else {
        alert("Erro ao fazer upload");
      }
    } catch {
      alert("Erro ao fazer upload");
    } finally {
      setEnviando(false);
    }
  }

  async function removerDocumento(docId: string) {
    if (!usuarioSelecionado) return;
    if (!confirm("Remover este documento?")) return;

    try {
      const res = await apiFetch(`/api/rh/documentos/${docId}?email=${encodeURIComponent(usuarioSelecionado.email)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setDocumentos((prev) => prev.filter((d) => d.id !== docId));
      }
    } catch {
      alert("Erro ao remover");
    }
  }

  async function baixarDocumento(doc: DocumentoRH) {
    if (!usuarioSelecionado) return;
    const res = await apiFetch(`/api/rh/documentos?email=${encodeURIComponent(usuarioSelecionado.email)}&download=${doc.id}`
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.nome;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Recursos Humanos</h1>
          <div className="flex items-center gap-1 mt-3 bg-gray-100 rounded-xl p-1 w-fit">
            <Link
              href="/rh"
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition ${
                pathname === "/rh"
                  ? "bg-white text-[#fb4d06] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Documentos
            </Link>
            <Link
              href="/rh/feedbacks"
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition ${
                pathname.startsWith("/rh/feedbacks")
                  ? "bg-white text-[#fb4d06] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Feedbacks
            </Link>
          </div>
          <p className="text-gray-500 text-sm mt-3">Gerencie os documentos dos colaboradores.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Lista de usuários ── */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Colaboradores</h2>

              {carregando ? (
                <p className="text-sm text-gray-400">Carregando...</p>
              ) : usuarios.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum usuário encontrado.</p>
              ) : (
                <div className="space-y-1">
                  {usuarios.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => selecionarUsuario(u)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition ${
                        usuarioSelecionado?.id === u.id
                          ? "bg-[#fb4d06]/10 text-[#fb4d06] font-semibold"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                      {u.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate">{u.nome}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Detalhes do usuário selecionado ── */}
        <div className="lg:col-span-2">
          {!usuarioSelecionado ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
              <svg className="w-14 h-14 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-gray-400 font-medium">Selecione um colaborador</p>
              <p className="text-gray-300 text-sm mt-1">Para ver ou adicionar documentos.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Cabeçalho do usuário */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#fb4d06]/10 flex items-center justify-center text-base font-bold text-[#fb4d06]">
                    {usuarioSelecionado.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-800">{usuarioSelecionado.nome}</p>
                    <p className="text-sm text-gray-400">{usuarioSelecionado.email}</p>
                  </div>
                </div>
              </div>

              {/* Upload */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Adicionar Documento</h3>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Categoria</label>
                    <select
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <label className="cursor-pointer bg-[#fb4d06] text-white font-semibold text-sm px-5 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50">
                    {enviando ? "Enviando..." : "Selecionar Arquivo"}
                    <input
                      type="file"
                      className="hidden"
                      disabled={enviando}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadDocumento(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Lista de documentos */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Documentos ({documentos.length})
                </h3>

                {carregandoDocs ? (
                  <p className="text-sm text-gray-400">Carregando...</p>
                ) : documentos.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-sm text-gray-400">Nenhum documento enviado ainda.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {documentos.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">{doc.nome}</p>
                            <p className="text-xs text-gray-400">
                              {CATEGORIAS.find((c) => c.key === doc.categoria)?.label || doc.categoria}
                              {" · "}{formatBytes(doc.tamanho)}
                              {" · "}{new Date(doc.uploadedAt).toLocaleDateString("pt-BR")}
                              {doc.uploadedBy && ` · por ${doc.uploadedBy}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <button
                            onClick={() => baixarDocumento(doc)}
                            className="text-xs font-medium text-[#fb4d06] hover:underline"
                          >
                            Baixar
                          </button>
                          <button
                            onClick={() => removerDocumento(doc.id)}
                            className="text-xs font-medium text-red-400 hover:text-red-600"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
    </WorkspaceLayout>
  );
}
