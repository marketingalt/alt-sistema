"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";

export default function NovoOrcamentoIA() {
  const router = useRouter();
  const areaRef = useRef<HTMLDivElement>(null);
  const [imagens, setImagens] = useState<File[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [temConteudo, setTemConteudo] = useState(false);

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = Array.from(e.clipboardData.items);
    const novasImagens: File[] = [];

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) novasImagens.push(file);
      }
    }

    if (novasImagens.length > 0) {
      setImagens((prev) => [...prev, ...novasImagens]);
      novasImagens.forEach((img) => {
        const url = URL.createObjectURL(img);
        const imgEl = document.createElement("img");
        imgEl.src = url;
        imgEl.style.maxWidth = "200px";
        imgEl.style.maxHeight = "150px";
        imgEl.style.borderRadius = "8px";
        imgEl.style.margin = "4px";
        imgEl.style.display = "inline-block";
        areaRef.current?.appendChild(imgEl);
      });
      e.preventDefault();
      setTemConteudo(true);
      return;
    }

    setTimeout(() => {
      setTemConteudo(!!(areaRef.current?.textContent?.trim() || imagens.length > 0));
    }, 0);
  }

  function handleInput() {
    setTemConteudo(!!(areaRef.current?.textContent?.trim() || imagens.length > 0));
  }

  function limpar() {
    if (areaRef.current) areaRef.current.innerHTML = "";
    setImagens([]);
    setArquivo(null);
    setTemConteudo(false);
    setErro("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const textoDigitado = areaRef.current?.innerText?.trim() || "";
    if (!textoDigitado && imagens.length === 0 && !arquivo) {
      setErro("Cole ou escreva o pedido antes de continuar.");
      return;
    }
    setErro("");
    setCarregando(true);

    try {
      const formData = new FormData();
      if (textoDigitado) formData.append("texto", textoDigitado);
      if (arquivo) formData.append("arquivo", arquivo);
      imagens.forEach((img, i) => formData.append(`imagem_${i}`, img));

      const res = await fetch("/api/extrair", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error();
      const dados = await res.json();
      sessionStorage.setItem("orcamento_rascunho", JSON.stringify(dados));
      router.push("/novo/revisar");
    } catch {
      setErro("Erro ao processar. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8">
        <div className="w-full max-w-2xl">
          <button
            onClick={() => router.push("/novo")}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>

          <h1 className="text-2xl font-bold text-gray-800 mb-1">Analisar Pedido com IA</h1>
          <p className="text-gray-500 mb-6">
            Cole o email ou texto do pedido — incluindo imagens. A IA lê tudo e monta o orçamento.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Cole o email ou pedido aqui
                </label>
                {temConteudo && (
                  <button type="button" onClick={limpar} className="text-xs text-gray-400 hover:text-red-500 transition">
                    Limpar
                  </button>
                )}
              </div>

              {!temConteudo && (
                <div className="absolute top-10 left-4 right-4 pointer-events-none text-gray-400 text-sm">
                  <p>Cole aqui com <kbd className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-xs font-mono">Cmd+V</kbd> — funciona com texto, imagens e emails completos</p>
                </div>
              )}

              <div
                ref={areaRef}
                contentEditable
                suppressContentEditableWarning
                onPaste={handlePaste}
                onInput={handleInput}
                className="w-full min-h-[220px] border border-gray-200 rounded-xl p-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/40 bg-white overflow-auto"
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              />

              {imagens.length > 0 && (
                <p className="text-xs text-[#fb4d06] mt-1">
                  {imagens.length} {imagens.length === 1 ? "imagem colada" : "imagens coladas"}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-gray-400 text-sm">ou envie um arquivo</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-5 text-center hover:border-[#fb4d06]/30 transition">
              <input
                type="file"
                id="arquivo"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setArquivo(f);
                  if (f) setTemConteudo(true);
                }}
              />
              <label htmlFor="arquivo" className="cursor-pointer">
                <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {arquivo ? (
                  <p className="text-[#fb4d06] text-sm font-medium">{arquivo.name}</p>
                ) : (
                  <p className="text-gray-500 text-sm">Clique para enviar PDF, Word ou imagem</p>
                )}
              </label>
            </div>

            {erro && <p className="text-red-500 text-sm">{erro}</p>}

            <button
              type="submit"
              disabled={carregando}
              className="bg-[#fb4d06] text-white font-semibold py-3 px-8 rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {carregando ? "Processando com IA..." : "Analisar Pedido com IA →"}
            </button>
          </form>
        </div>
      </main>
    </WorkspaceLayout>
  );
}
