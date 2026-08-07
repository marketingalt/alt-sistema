"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import type { Orcamento, ItemOrcamento } from "@/app/types";
import { FORMA_LINK_CARTAO, infoFrete } from "@/lib/calculos";
import { apiFetch } from "@/lib/api-fetch";

const ALT_EMPRESA = "ALT. MARKETING E PUBLICIDADE";
const ALT_CNPJ = "45.025.544/0001-92";

function fmt(v: number) {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Estilo inline reutilizável para campos editáveis que parecem texto ───
const INPUT_CLS =
  "bg-transparent border-none outline-none focus:outline-dashed focus:outline-1 focus:outline-[#fb4d06]/40 hover:outline-dashed hover:outline-1 hover:outline-gray-200 px-0.5 -mx-0.5 rounded transition-all cursor-text";

// ─── Botão de export ───
const COL_W = { img: 36, qtd: 30, und: 26, vun: 74, vtot: 82 };

type Props = {
  orcamento: Orcamento;
  onUpdateCampo: (campo: keyof Orcamento, valor: string | number | boolean) => void;
  onUpdateItem: (itemId: string, campo: keyof ItemOrcamento, valor: string | number | boolean | undefined) => void;
  onDownloadPdf: () => void;
  gerandoPdf: boolean;
};

export default function DocumentoPreview({ orcamento, onUpdateCampo, onUpdateItem, onDownloadPdf, gerandoPdf }: Props) {
  const imgRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [hoveredImg, setHoveredImg] = useState<string | null>(null);
  const [logoOrcamento, setLogoOrcamento] = useState<string | null | undefined>(orcamento.logoOrcamento);
  const [logoPadrao, setLogoPadrao] = useState<string | null>(null);
  const [hoverLogo, setHoverLogo] = useState(false);
  const logoSelRef = useRef<HTMLInputElement | null>(null);

  // Carrega a logo padrão de orçamentos (fallback quando o orçamento não tem a sua)
  useEffect(() => {
    if (orcamento.logoOrcamento) return;
    apiFetch("/api/admin/logo-orcamento")
      .then((r) => r.json())
      .then((data) => {
        if (data.logoBase64) setLogoPadrao(data.logoBase64);
      })
      .catch(() => {});
  }, [orcamento.logoOrcamento]);

  const logo = logoOrcamento || logoPadrao;

  // Upload de logo
  const uploadLogo = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setLogoOrcamento(b64);
      onUpdateCampo("logoOrcamento", b64);
    };
    reader.readAsDataURL(file);
  }, [onUpdateCampo]);

  const removerLogo = useCallback(() => {
    setLogoOrcamento(null);
    onUpdateCampo("logoOrcamento", "");
  }, [onUpdateCampo]);

  const totalProdutos = orcamento.itens.reduce((a, i) => a + (i.total || 0), 0);
  const totalServicos = orcamento.manuseio && orcamento.custoManuseio ? orcamento.custoManuseio : 0;
  const { valor: valorFrete, descricao: freteDesc } = infoFrete(orcamento);
  const totalGeral = totalProdutos + totalServicos + valorFrete;
  const taxaCartao = orcamento.formaPagamento === FORMA_LINK_CARTAO ? (orcamento.taxaCartao || 0) : 0;
  const totalFinal = totalGeral + taxaCartao;
  const aprovado = orcamento.status === "Aprovado";
  const mostrarTotalItem = orcamento.mostrarValorTotalItem === true;

  const titulo = [
    orcamento.cliente?.toUpperCase(),
    orcamento.nomeProjeto ? orcamento.nomeProjeto.toUpperCase() : null,
  ].filter(Boolean).join(": ") || orcamento.cliente?.toUpperCase();

  const handleImageUpload = useCallback(
    (itemId: string, file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        onUpdateItem(itemId, "imagemReferencia", reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [onUpdateItem]
  );

  const removerImagem = useCallback(
    (itemId: string) => {
      onUpdateItem(itemId, "imagemReferencia", "");
    },
    [onUpdateItem]
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none">
      {/* ─── Documento Preview ─── */}
      <div className="overflow-x-auto">
        <div className="min-w-[950px] max-w-[1100px] mx-auto font-sans" style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>
          {/* ═══ CABEÇALHO ESCURO ═══ */}
          <div className="bg-[#1a1a2e]">
            <div className="flex px-5 pt-3 pb-2.5">
              {/* Coluna esquerda */}
              <div className="flex-1 space-y-1">
                <HeaderField label="EMPRESA:" value={ALT_EMPRESA} readOnly />
                <HeaderField label="Nº DA PROPOSTA:" value={orcamento.numero} readOnly />
                <HeaderField
                  label="CLIENTE/END.:"
                  value={orcamento.cliente}
                  onChange={(v) => onUpdateCampo("cliente", v)}
                />
                <HeaderField
                  label="SOLICITANTE:"
                  value={orcamento.solicitante || "—"}
                  onChange={(v) => onUpdateCampo("solicitante", v)}
                />
                <HeaderField
                  label="ELABORADA POR:"
                  value={orcamento.responsavel || "—"}
                  onChange={(v) => onUpdateCampo("responsavel", v)}
                />
              </div>
              {/* Coluna direita */}
              <div className="flex-1 space-y-1">
                <HeaderField label="CNPJ:" value={ALT_CNPJ} readOnly />
                <HeaderField
                  label="DATA SOLICITAÇÃO:"
                  value={orcamento.dataSolicitacao || "—"}
                  onChange={(v) => onUpdateCampo("dataSolicitacao", v)}
                />
                <HeaderField
                  label="DATA ELABORAÇÃO:"
                  value={orcamento.dataOrcamento}
                  onChange={(v) => onUpdateCampo("dataOrcamento", v)}
                />
                <div className="flex">
                  <span className="text-[6.5px] text-gray-400 shrink-0" style={{ width: 95 }}>
                    TIPO DE NOTA:
                  </span>
                  <div className="flex gap-1">
                    {(["DANFE", "NFSE"] as const).map((tipo) => {
                      const ativo = (orcamento.tiposNota || []).includes(tipo);
                      return (
                        <button
                          key={tipo}
                          type="button"
                          onClick={() => {
                            const atuais = orcamento.tiposNota || [];
                            const novo = atuais.includes(tipo)
                              ? atuais.filter((t) => t !== tipo)
                              : [...atuais, tipo];
                            onUpdateCampo("tiposNota" as keyof Orcamento, novo as unknown as string);
                          }}
                          className={`text-[8px] font-bold px-1.5 py-0.5 rounded border transition ${
                            ativo
                              ? "bg-amber-500 text-white border-amber-500"
                              : "bg-transparent text-gray-400 border-gray-600 hover:border-gray-400"
                          }`}
                        >
                          {tipo}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* Logo */}
              <div
                className="relative flex flex-col items-end justify-center ml-4 cursor-pointer"
                onMouseEnter={() => setHoverLogo(true)}
                onMouseLeave={() => setHoverLogo(false)}
                onClick={() => logoSelRef.current?.click()}
              >
                {logo ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo} className="w-auto object-contain" style={{ height: 55 }} alt="Logo" />
                    {hoverLogo && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removerLogo(); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] shadow-md hover:bg-red-600"
                      >
                        ×
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[28px] font-bold text-[#D4AF37] leading-none">alt.</span>
                    <span className="text-[6.5px] text-gray-400">marketing</span>
                    {hoverLogo && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded text-white text-[9px] font-bold">
                        + Logo
                      </div>
                    )}
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={logoSelRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadLogo(file);
                }}
              />
            </div>

            {/* ─── Faixa status ─── */}
            <div className="flex bg-[#111827] px-5 py-1.5">
              <div className="flex-1 flex items-center gap-1">
                <span className="text-[7px] text-gray-400">PRAZO DE ENTREGA:</span>
                <input
                  className={`${INPUT_CLS} text-[8px] font-bold text-amber-400`}
                  value={orcamento.prazoEntrega || ""}
                  onChange={(e) => onUpdateCampo("prazoEntrega", e.target.value)}
                  placeholder="—"
                />
              </div>
              <div className="flex-1 flex items-center gap-1">
                <span className="text-[7px] text-gray-400">PAGAMENTO:</span>
                <input
                  className={`${INPUT_CLS} text-[8px] font-bold text-amber-400`}
                  value={orcamento.prazoPagamento || ""}
                  onChange={(e) => onUpdateCampo("prazoPagamento", e.target.value)}
                  placeholder="—"
                />
              </div>
              <div className="flex-[0.6] flex items-center gap-1">
                <span className="text-[7px] text-gray-400">APROVADO:</span>
                {aprovado ? (
                  <span className="bg-green-900 text-green-300 text-[7.5px] font-bold px-1 py-0.5 rounded">
                    SIM
                  </span>
                ) : (
                  <span className="text-[8px] font-bold text-amber-400">{orcamento.status}</span>
                )}
              </div>
            </div>
          </div>

          {/* ═══ TÍTULO LARANJA ═══ */}
          <div className="bg-[#fb4d06] px-5 py-2">
            <input
              className={`${INPUT_CLS} text-[12px] font-bold text-white w-full`}
              value={titulo}
              onChange={(e) => {
                // Smarter: try to split back into client + project
                const parts = e.target.value.split(": ");
                if (parts.length >= 2) {
                  onUpdateCampo("cliente", parts[0]);
                  onUpdateCampo("nomeProjeto", parts.slice(1).join(": "));
                } else {
                  onUpdateCampo("cliente", e.target.value);
                }
              }}
            />
          </div>

          {/* ═══ TABELA DE ITENS ═══ */}
          <div className="px-4 mt-2">
            {/* Cabeçalho da tabela */}
            <div className="flex bg-gray-700 py-1 px-1.5 rounded-t" style={{ fontSize: 7 }}>
              <span className="font-bold text-gray-100" style={{ width: COL_W.img }}> </span>
              <span className="font-bold text-gray-100 flex-1">MATERIAL / OPERACIONAL</span>
              <span className="font-bold text-gray-100 text-right" style={{ width: COL_W.qtd }}>QTD</span>
              <span className="font-bold text-gray-100 text-right" style={{ width: COL_W.und }}>UN.</span>
              <span className="font-bold text-gray-100 text-right" style={{ width: COL_W.vun }}>R$ UNIT.</span>
              {mostrarTotalItem && <span className="font-bold text-gray-100 text-right" style={{ width: COL_W.vtot }}>R$ TOTAL</span>}
            </div>

            {/* Linhas de itens */}
            {orcamento.itens.map((item, idx) => {
              const hasImg = !!item.imagemReferencia;
              return (
                <React.Fragment key={item.id}>
                <div
                  className={`flex py-1 px-1.5 items-center border-b border-gray-100 text-[8px] ${idx % 2 !== 0 ? "bg-gray-50" : ""}`}
                  style={{ minHeight: 32 }}
                >
                  {/* Imagem */}
                  <div
                    className="relative cursor-pointer"
                    style={{ width: COL_W.img }}
                    onMouseEnter={() => setHoveredImg(item.id)}
                    onMouseLeave={() => setHoveredImg(null)}
                    onClick={() => imgRefs.current[item.id]?.click()}
                  >
                    {hasImg ? (
                      <div className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imagemReferencia}
                          alt=""
                          className="w-7 h-7 rounded object-cover"
                        />
                        {hoveredImg === item.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removerImagem(item.id);
                            }}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[7px]"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="w-7 h-7 bg-gray-200 rounded flex items-center justify-center text-gray-400 hover:bg-[#fb4d06]/10 hover:border hover:border-[#fb4d06]/30 transition-all">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={(el) => { imgRefs.current[item.id] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(item.id, file);
                      }}
                    />
                  </div>

                  {/* Material / Operacional */}
                  <div className="flex-1 min-w-0">
                    <input
                      className={`${INPUT_CLS} font-bold text-gray-900 w-full`}
                      style={{ fontSize: 8 }}
                      value={item.item}
                      onChange={(e) => onUpdateItem(item.id, "item", e.target.value)}
                      placeholder="Nome do item"
                    />
                    {/* Cor do item (só para brindes/produtos) */}
                    {item.categoria !== "servico" && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          type="color"
                          className="w-3 h-3 p-0 border-0 cursor-pointer rounded"
                          value={item.cor || "#000000"}
                          onChange={(e) => onUpdateItem(item.id, "cor", e.target.value)}
                          title="Cor do item"
                        />
                        <input
                          className={`${INPUT_CLS} text-gray-400 w-16`}
                          style={{ fontSize: 6.5 }}
                          value={item.cor || ""}
                          onChange={(e) => onUpdateItem(item.id, "cor", e.target.value)}
                          placeholder="Cor"
                        />
                      </div>
                    )}
                    {item.ncm && (
                      <span className="text-[6px] text-gray-400 font-mono mt-0.5 block">
                        NCM: {item.ncm}
                      </span>
                    )}
                    {item.descricao && (
                      <textarea
                        className={`${INPUT_CLS} text-gray-500 w-full resize-none leading-tight mt-0.5`}
                        style={{ fontSize: 6.5, lineHeight: "1.3" }}
                        value={item.descricao}
                        onChange={(e) => onUpdateItem(item.id, "descricao", e.target.value)}
                        placeholder="Descrição técnica"
                        rows={1}
                      />
                    )}
                    {/* Quick toggle to show/hide description */}
                    {!item.descricao && (
                      <button
                        onClick={() => onUpdateItem(item.id, "descricao", " ")}
                        className="text-[6px] text-gray-300 hover:text-gray-500 mt-0.5"
                      >
                        + descrição
                      </button>
                    )}
                    {item.categoria !== "servico" && (
                      <span className="inline-flex items-center gap-2 mt-0.5 text-[6.5px] text-gray-400 font-medium flex-wrap">
                        {item.acabamento && item.acabamento !== "—" && (
                          <>
                            <svg className="w-2.5 h-2.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4z" />
                            </svg>
                            {item.acabamento}
                          </>
                        )}
                        {item.kit && item.kit !== "—" && (
                          <>
                            <svg className="w-2.5 h-2.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            {item.kit}
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Qtd */}
                  <input
                    type="number"
                    min={0}
                    className={`${INPUT_CLS} text-gray-700 text-right`}
                    style={{ width: COL_W.qtd, fontSize: 8 }}
                    value={item.quantidade || ""}
                    onChange={(e) => onUpdateItem(item.id, "quantidade", parseInt(e.target.value) || 0)}
                  />

                  {/* Un */}
                  <span className="text-gray-500 text-right" style={{ width: COL_W.und, fontSize: 8 }}>
                    UN
                  </span>

                  {/* Valor unitário */}
                  <div className="relative" style={{ width: COL_W.vun }}>
                    <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-gray-400 text-[7px] pointer-events-none">R$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={`${INPUT_CLS} text-gray-700 text-right pl-4 w-full`}
                      style={{ fontSize: 8 }}
                      value={item.valorUnitario || ""}
                      onChange={(e) => onUpdateItem(item.id, "valorUnitario", Number(e.target.value))}
                    />
                  </div>

                  {/* Valor total */}
                  {mostrarTotalItem && (
                    <span
                      className="font-bold text-right"
                      style={{ width: COL_W.vtot, fontSize: 8, color: "#fb4d06" }}
                    >
                      {fmt(item.total)}
                    </span>
                  )}
                </div>

                {/* ═══ Variantes (sub-rows) ═══ */}
                {item.variantes && item.variantes.length > 0 && (
                  item.variantes.map((v) => (
                    <div key={v.id} className="flex py-0.5 px-1.5 items-center border-b border-dashed border-emerald-100 text-[7.5px] bg-emerald-50/30" style={{ minHeight: 22 }}>
                      <div className="text-center" style={{ width: COL_W.img }}>
                        <svg className="w-2.5 h-2.5 inline-block text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <span className="flex-1 text-emerald-700">
                        {v.descricao || item.item}
                      </span>
                      <span className="text-emerald-700 text-right font-medium" style={{ width: COL_W.qtd, fontSize: 7.5 }}>
                        {v.quantidade}
                      </span>
                      <span className="text-emerald-600 text-right" style={{ width: COL_W.und, fontSize: 7.5 }}>UN</span>
                      <span className="text-emerald-700 text-right" style={{ width: COL_W.vun, fontSize: 7.5 }}>
                        R$ {v.valorUnitario.toFixed(2)}
                      </span>
                      {mostrarTotalItem && (
                        <span className="text-emerald-700 font-medium text-right" style={{ width: COL_W.vtot, fontSize: 7.5 }}>
                          {fmt(v.total)}
                        </span>
                      )}
                    </div>
                  ))
                )}
                </React.Fragment>
              );
            })}

            {/* Linha de frete/logística — aparece sempre que houver frete (valor ou descrição) */}
            {(valorFrete > 0 || freteDesc) && (
              <div className="flex py-1 px-1.5 items-center border-b border-gray-100 text-[8px] bg-blue-50" style={{ minHeight: 32 }}>
                <div className="text-gray-400 text-center" style={{ width: COL_W.img }}> </div>
                <span className="flex-1 font-bold text-blue-800 text-[8px]">LOGÍSTICA DE ENTREGA{freteDesc ? ` — ${freteDesc}` : ""}</span>
                <span className="text-gray-700 text-right" style={{ width: COL_W.qtd, fontSize: 8 }}>1</span>
                <span className="text-gray-500 text-right" style={{ width: COL_W.und, fontSize: 8 }}>—</span>
                <span className="text-gray-500 text-right" style={{ width: COL_W.vun, fontSize: 8 }}>—</span>
                {mostrarTotalItem && (
                  <span className="font-bold text-right" style={{ width: COL_W.vtot, fontSize: 8, color: "#1e40af" }}>
                    {valorFrete > 0 ? fmt(valorFrete) : "—"}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ═══ CUSTOS INTERNOS ═══ */}
          {orcamento.manuseio && orcamento.custoManuseio ? (
            <div className="px-4 mt-2.5">
              <div className="bg-gray-700 px-2 py-1 rounded-t">
                <span className="text-[7.5px] font-bold text-white">CUSTOS INTERNOS</span>
              </div>
              <div className="border border-gray-200 border-t-0 rounded-b overflow-hidden">
                <div className="flex bg-gray-700/10 py-1 px-1.5 text-[7px] font-bold text-gray-600">
                  <span className="flex-1">SERVIÇO / MATERIAL</span>
                  <span className="text-right" style={{ width: 40 }}>QTD</span>
                  <span className="text-right" style={{ width: 45 }}>FREQ.</span>
                  <span className="text-right" style={{ width: 95 }}>VALOR UNITÁRIO</span>
                  <span className="text-right" style={{ width: 95 }}>VALOR TOTAL</span>
                </div>
                <div className="flex py-1 px-1.5 items-center text-[8px]">
                  <span className="flex-1 text-gray-700">Manuseio específico do projeto</span>
                  <span className="text-right text-gray-700" style={{ width: 40 }}>1</span>
                  <span className="text-right text-gray-500" style={{ width: 45 }}>R$</span>
                  <span className="text-right text-gray-700" style={{ width: 95 }}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={`${INPUT_CLS} text-right w-full`}
                      value={orcamento.custoManuseio || ""}
                      onChange={(e) => onUpdateCampo("custoManuseio", parseFloat(e.target.value) || 0)}
                    />
                  </span>
                  <span
                    className="font-bold text-right"
                    style={{ width: 95, color: "#fb4d06" }}
                  >
                    {fmt(orcamento.custoManuseio)}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* ═══ TOTAL ═══ */}
          {!mostrarTotalItem && (
          <div className="px-4 mt-2.5 pt-2 border-t-2 border-[#fb4d06] flex justify-end items-center">
            {(orcamento.manuseio && orcamento.custoManuseio) || valorFrete > 0 || taxaCartao > 0 ? (
              <div className="text-right mr-3.5 text-[7.5px] text-gray-400 space-y-0.5">
                <div>Produtos: {fmt(totalProdutos)}</div>
                {orcamento.manuseio && orcamento.custoManuseio ? (
                  <div>Serviços: {fmt(totalServicos)}</div>
                ) : null}
                {valorFrete > 0 ? <div>Frete: {fmt(valorFrete)}</div> : null}
                {taxaCartao > 0 ? <div>Taxa cartão: {fmt(taxaCartao)}</div> : null}
              </div>
            ) : null}
            <span className="text-[11px] font-bold text-gray-700 mr-3.5">TOTAL</span>
            <span className="text-[18px] font-bold text-[#fb4d06]">{fmt(totalFinal)}</span>
          </div>
          )}

          {/* ═══ HONORÁRIOS E IMPOSTOS ═══ */}
          {!mostrarTotalItem && orcamento.mostrarHonorarios && ((orcamento.percHonorarios ?? 0) > 0 || (orcamento.percImpostos ?? 0) > 0) ? (
            <div className="px-4 mt-2.5">
              <div className="border border-gray-200 rounded overflow-hidden">
                <div className="bg-gray-50 px-2.5 py-1 border-b border-gray-200">
                  <span className="text-[7.5px] font-bold text-gray-700">COMPOSIÇÃO DO VALOR TOTAL</span>
                </div>
                {(orcamento.percHonorarios ?? 0) > 0 && (
                  <div className="flex justify-between items-center px-2.5 py-1 border-b border-gray-100 text-[8px]">
                    <span className="text-gray-500">
                      Honorários
                      <span className="text-gray-400 ml-1">({orcamento.percHonorarios}%)</span>
                    </span>
                    <span className="font-bold text-gray-700">
                      {fmt(totalGeral * (orcamento.percHonorarios ?? 0) / 100)}
                    </span>
                  </div>
                )}
                {(orcamento.percImpostos ?? 0) > 0 && (
                  <div className="flex justify-between items-center px-2.5 py-1 text-[8px]">
                    <span className="text-gray-500">
                      Impostos
                      <span className="text-gray-400 ml-1">({orcamento.percImpostos}%)</span>
                    </span>
                    <span className="font-bold text-gray-700">
                      {fmt(totalGeral * (orcamento.percImpostos ?? 0) / 100)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* ═══ OBSERVAÇÕES ═══ */}
          {orcamento.observacoes ? (
            <div className="px-4 mt-2">
              <div className="bg-yellow-100 px-2 py-1 rounded text-[7.5px] text-amber-800">
                OBS.:{" "}
                <textarea
                  className={`${INPUT_CLS} text-amber-800 w-full resize-none align-top`}
                  style={{ fontSize: 7.5 }}
                  value={orcamento.observacoes}
                  onChange={(e) => onUpdateCampo("observacoes", e.target.value)}
                  rows={1}
                />
              </div>
            </div>
          ) : null}

          {/* ═══ Rodapé do Documento ═══ */}
          <div className="text-center text-[6.5px] text-gray-400 mt-4 pb-3 border-t border-gray-100 pt-2">
            Orçamento gerado por <strong>alt. marketing</strong> · Documento com valor de proposta
          </div>
        </div>
      </div>

      {/* ═══ Barra de ação ─── não vai no print ═══ */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Tipo:</span>
          <button
            onClick={() => onUpdateCampo("mostrarHonorarios", !orcamento.mostrarHonorarios)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
              orcamento.mostrarHonorarios
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
            }`}
          >
            {orcamento.mostrarHonorarios ? "✓ " : ""}Honorários
          </button>
        </div>
        <button
          onClick={onDownloadPdf}
          disabled={gerandoPdf}
          className="bg-gray-800 text-white text-sm font-semibold py-2 px-6 rounded-xl hover:bg-gray-700 transition disabled:opacity-50 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {gerandoPdf ? "Gerando..." : "Exportar PDF"}
        </button>
      </div>
    </div>
  );
}

// ─── Campo do cabeçalho (texto rotulado + valor) ───
function HeaderField({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex">
      <span className="text-[6.5px] text-gray-400 shrink-0" style={{ width: 95 }}>
        {label}
      </span>
      {readOnly ? (
        <span className="text-[8px] font-bold text-white">{value}</span>
      ) : (
        <input
          className={`${INPUT_CLS} text-[8px] font-bold text-white flex-1 min-w-0`}
          value={value === "—" ? "" : value}
          onChange={(e) => onChange?.(e.target.value || "—")}
          placeholder="—"
        />
      )}
    </div>
  );
}
