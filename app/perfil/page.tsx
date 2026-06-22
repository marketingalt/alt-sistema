"use client";

import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";

interface DocumentoRH {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  uploadedAt: string;
  uploadedBy: string;
  categoria: string;
}

const CATEGORIAS: Record<string, string> = {
  contrato: "Contrato",
  ficha: "Ficha Cadastro",
  "doc pessoal": "Documento Pessoal",
  outro: "Outro",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PerfilPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");
  const [documentos, setDocumentos] = useState<DocumentoRH[]>([]);
  const [carregandoDocs, setCarregandoDocs] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.replace("/sign-in");
      return;
    }
    const nomeAtual = (user.publicMetadata?.nomeExibicao as string) || user.fullName || user.firstName || "";
    setNome(nomeAtual);
    carregarDocumentos();
  }, [isLoaded, user]);

  async function carregarDocumentos() {
    setCarregandoDocs(true);
    try {
      const res = await fetch("/api/rh/documentos");
      if (res.ok) {
        const data = await res.json();
        setDocumentos(data.documentos || []);
      }
    } catch {
      // silencioso
    } finally {
      setCarregandoDocs(false);
    }
  }

  async function salvarNome() {
    if (!nome.trim()) {
      setErro("Informe um nome válido.");
      return;
    }
    setSalvando(true);
    setErro("");
    setSalvo(false);
    try {
      const res = await fetch("/api/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomeExibicao: nome.trim() }),
      });
      if (!res.ok) throw new Error();
      setSalvo(true);
      await user?.reload();
      setTimeout(() => setSalvo(false), 3000);
    } catch {
      setErro("Erro ao salvar nome.");
    } finally {
      setSalvando(false);
    }
  }

  async function trocarFoto() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !user) return;
      try {
        await user.setProfileImage({ file });
        await user.reload();
      } catch {
        setErro("Erro ao atualizar foto.");
      }
    };
    input.click();
  }

  async function baixarDocumento(doc: DocumentoRH) {
    const res = await fetch(`/api/rh/documentos?email=${encodeURIComponent(user?.emailAddresses[0]?.emailAddress || "")}&download=${doc.id}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.nome;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!isLoaded) {
    return (
      <WorkspaceLayout>
        <main className="flex items-center justify-center min-h-screen">
          <p className="text-gray-400">Carregando...</p>
        </main>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Meu Perfil</h1>
        <p className="text-gray-500 text-sm mb-8">Gerencie suas informações e veja seus documentos.</p>

        <div className="space-y-6">
          {/* ── Foto + Nome ── */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">Informações Pessoais</h2>

          <div className="flex items-center gap-6 mb-6">
            {/* Foto */}
            <div className="relative group">
              {user?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.imageUrl}
                  alt="Foto"
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#fb4d06]/10 flex items-center justify-center text-2xl font-bold text-[#fb4d06] border-2 border-gray-200">
                  {nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
              )}
              <button
                onClick={trocarFoto}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold"
              >
                Trocar
              </button>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-800">{user?.fullName || nome}</p>
              <p className="text-xs text-gray-400">{user?.emailAddresses[0]?.emailAddress}</p>
              <span className="text-[11px] text-gray-400 mt-1 inline-block">Clique na foto para trocar</span>
            </div>
          </div>

          {/* Nome de exibição */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome de exibição</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nome}
                onChange={(e) => { setNome(e.target.value); setErro(""); setSalvo(false); }}
                placeholder="Como você quer ser chamado"
                maxLength={60}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
              />
              <button
                onClick={salvarNome}
                disabled={salvando}
                className="bg-[#fb4d06] text-white font-semibold text-sm px-5 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
            {salvo && <p className="text-xs text-green-600 mt-1">Nome salvo com sucesso!</p>}
            {erro && <p className="text-xs text-red-500 mt-1">{erro}</p>}
          </div>
        </section>

        {/* ── Documentos RH ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Documentos</h2>
          <p className="text-xs text-gray-400 mb-4">
            Documentos enviados pelo RH vinculados ao seu email.
          </p>

          {carregandoDocs ? (
            <p className="text-sm text-gray-400">Carregando documentos...</p>
          ) : documentos.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-gray-400">Nenhum documento vinculado ainda.</p>
              <p className="text-xs text-gray-300 mt-1">O RH pode enviar documentos para seu email.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {documentos.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{doc.nome}</p>
                      <p className="text-xs text-gray-400">
                        {CATEGORIAS[doc.categoria] || doc.categoria} · {formatBytes(doc.tamanho)} · {new Date(doc.uploadedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => baixarDocumento(doc)}
                    className="text-xs font-medium text-[#fb4d06] hover:underline shrink-0 ml-3"
                  >
                    Baixar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
    </WorkspaceLayout>
  );
}
