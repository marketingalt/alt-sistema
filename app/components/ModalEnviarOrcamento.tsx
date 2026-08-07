"use client";

import { useEffect, useMemo, useState } from "react";
import type { Orcamento } from "@/app/types";
import {
  detectarPendencias,
  gerarAssuntoEmail,
  gerarCorpoEmail,
} from "@/lib/email-orcamento";
import { apiFetch } from "@/lib/api-fetch";

type TipoPdf = "especificacoes" | "valores" | "os";

interface Props {
  orcamento: Orcamento;
  aberto: boolean;
  onFechar: () => void;
  onDownloadPdf: (tipo: TipoPdf) => void;
  gerandoPdf?: boolean;
}

const INPUT_CLS =
  "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white";

function copiar(texto: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(texto);
  }
  // Fallback para contexto não seguro
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      resolve();
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(ta);
    }
  });
}

export default function ModalEnviarOrcamento({ orcamento, aberto, onFechar, onDownloadPdf, gerandoPdf }: Props) {
  // O componente só é montado com o modal aberto, então os states nascem
  // pré-preenchidos a partir do orçamento a cada abertura.
  const pendenciasIniciais = useMemo(() => detectarPendencias(orcamento), [orcamento]);

  const [para, setPara] = useState("");
  const [assunto, setAssunto] = useState(() => gerarAssuntoEmail(orcamento));
  const [corpo, setCorpo] = useState(() => gerarCorpoEmail(orcamento));
  const [pendencias] = useState(pendenciasIniciais);
  const [pendMarcadas, setPendMarcadas] = useState<Record<string, boolean>>(() => {
    const r: Record<string, boolean> = {};
    pendenciasIniciais.forEach((p) => (r[p] = true));
    return r;
  });
  const [outrasPendencias, setOutrasPendencias] = useState("");
  const [copiado, setCopiado] = useState<"assunto" | "corpo" | null>(null);
  const [carregandoEmail, setCarregandoEmail] = useState(false);

  // Pré-preenche o "Para:" com o e-mail do cliente cadastrado
  useEffect(() => {
    if (!orcamento.clienteId) return;
    let ativo = true;
    setCarregandoEmail(true);
    apiFetch(`/api/clientes/${orcamento.clienteId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (ativo && c) setPara(c.emailContato || c.emailContatoFinanceiro || "");
      })
      .catch(() => {
        // silencioso — usuário pode digitar o e-mail
      })
      .finally(() => {
        if (ativo) setCarregandoEmail(false);
      });
    return () => {
      ativo = false;
    };
  }, [orcamento.clienteId]);

  function regenerarCorpo() {
    const selecionadas = pendencias.filter((p) => pendMarcadas[p]);
    setCorpo(gerarCorpoEmail(orcamento, { pendencias: selecionadas, outrasPendencias }));
  }

  async function copiarCampo(qual: "assunto" | "corpo") {
    try {
      await copiar(qual === "assunto" ? assunto : corpo);
      setCopiado(qual);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      // silencioso
    }
  }

  const mailto = useMemo(() => {
    const s = new URLSearchParams();
    if (assunto) s.set("subject", assunto);
    if (corpo) s.set("body", corpo);
    return `mailto:${para}?${s.toString()}`;
  }, [para, assunto, corpo]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onFechar} />
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-800">✉️ Enviar orçamento #{orcamento.numero}</h2>
          <button
            onClick={onFechar}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1"
            title="Fechar"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* ── A. Baixar documento ── */}
          <section>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-3">Baixar documento</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onDownloadPdf("valores")}
                disabled={gerandoPdf}
                className="bg-gray-800 text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
              >
                ⬇ PDF Valores
              </button>
              <button
                onClick={() => onDownloadPdf("especificacoes")}
                disabled={gerandoPdf}
                className="border border-gray-200 text-gray-700 text-sm font-semibold py-2 px-4 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                ⬇ PDF Especificações
              </button>
              <button
                onClick={() => onDownloadPdf("os")}
                disabled={gerandoPdf}
                className="border border-gray-200 text-gray-700 text-sm font-semibold py-2 px-4 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                ⬇ PDF OS
              </button>
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* ── B. E-mail para o cliente ── */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">E-mail para o cliente</h3>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Para</label>
              <input
                type="email"
                value={para}
                onChange={(e) => setPara(e.target.value)}
                placeholder="email@cliente.com"
                className={INPUT_CLS}
                disabled={carregandoEmail}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Assunto</label>
              <input
                type="text"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Pendências a combinar</label>
              {pendencias.length > 0 ? (
                <div className="space-y-1.5 mb-2">
                  {pendencias.map((p) => (
                    <label key={p} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!pendMarcadas[p]}
                        onChange={() => setPendMarcadas((prev) => ({ ...prev, [p]: !prev[p] }))}
                        className="mt-0.5"
                      />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-green-700 mb-2">✓ Nenhuma pendência detectada no orçamento.</p>
              )}
              <textarea
                value={outrasPendencias}
                onChange={(e) => setOutrasPendencias(e.target.value)}
                rows={2}
                placeholder="Outras pendências a combinar (uma por linha)…"
                className={INPUT_CLS}
              />
            </div>

            <button
              onClick={regenerarCorpo}
              className="border border-[#fb4d06] text-[#fb4d06] text-sm font-semibold py-2 px-4 rounded-lg hover:bg-[#fb4d06]/5 transition"
            >
              ↻ Gerar texto do e-mail
            </button>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Corpo do e-mail</label>
              <textarea
                value={corpo}
                onChange={(e) => setCorpo(e.target.value)}
                rows={14}
                className={`${INPUT_CLS} text-sm leading-relaxed`}
              />
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => copiarCampo("assunto")}
                className="border border-gray-200 text-gray-700 text-sm font-semibold py-2 px-4 rounded-lg hover:bg-gray-50 transition"
              >
                {copiado === "assunto" ? "✓ Assunto copiado" : "📋 Copiar assunto"}
              </button>
              <button
                onClick={() => copiarCampo("corpo")}
                className="border border-gray-200 text-gray-700 text-sm font-semibold py-2 px-4 rounded-lg hover:bg-gray-50 transition"
              >
                {copiado === "corpo" ? "✓ Texto copiado" : "📋 Copiar texto"}
              </button>
              <a
                href={mailto}
                className="bg-[#fb4d06] text-white text-sm font-semibold py-2 px-4 rounded-lg hover:opacity-90 transition"
              >
                ✉️ Abrir no Gmail/Outlook
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
