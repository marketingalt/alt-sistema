"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Orcamento, ItemOrcamento, StatusOrcamento, Fornecedor } from "@/app/types";
import { STATUS_CONFIG } from "@/app/types";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import { calcularCustoTotal, calcularValorSugerido, calcularMargemReal, recalcularItem, temSurchargeQtdMinima } from "@/lib/calculos";
import PedidoComprasAnexo from "@/app/components/PedidoComprasAnexo";
import CampoData from "@/app/components/CampoData";
import CalculadoraFrete from "@/app/components/CalculadoraFrete";
import CampoPrazoEntrega from "@/app/components/CampoPrazoEntrega";
import CampoPrazoPagamento from "@/app/components/CampoPrazoPagamento";
import type { DocumentoFornecedor } from "@/app/types";
import DocumentoPreview from "./DocumentoPreview";

const TODOS_STATUS = Object.keys(STATUS_CONFIG) as StatusOrcamento[];

const TIPOS = ["Silk", "DTF", "Bordado", "Laser", "Verniz UV", "Tampografia", "Sublimação", "Gravação em relevo", "Outro"];
const MARGEM_PADRAO = 30;
const PERC_HONORARIOS_PADRAO = 10;
const PERC_IMPOSTOS_PADRAO = 19;
const PERC_COMISSAO_PADRAO = 5;

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

function itemVazio(margem: number): ItemOrcamento {
  return {
    id: gerarId(), kit: "", referencia: "", item: "", acabamento: "Silk", descricao: "",
    quantidade: 0, custoUnitario: 0, freteProducao: 0, custoPersonalizacao: 0,
    margem, valorUnitario: 0, valorAjustado: false, total: 0, diasProducao: undefined, ncm: "",
  };
}

function migrarItem(i: Partial<ItemOrcamento>, margemPadrao: number): ItemOrcamento {
  return {
    id: i.id || gerarId(),
    kit: i.kit || "", referencia: i.referencia || "",
    fornecedorId: i.fornecedorId || "",
    fornecedorNome: i.fornecedorNome || "",
    item: i.item || "",
    cor: i.cor || "",
    ncm: i.ncm || "",
    quantidadeMinima: i.quantidadeMinima ? Number(i.quantidadeMinima) : undefined,
    diasProducao: i.diasProducao ? Number(i.diasProducao) : undefined,
    acabamento: i.acabamento || "Silk", descricao: i.descricao || "",
    quantidade: Number(i.quantidade) || 0,
    custoUnitario: Number(i.custoUnitario) || 0,
    freteProducao: Number(i.freteProducao) || 0,
    custoPersonalizacao: Number(i.custoPersonalizacao) || 0,
    custoEmbalagemIndividual: i.custoEmbalagemIndividual !== undefined ? Number(i.custoEmbalagemIndividual) : undefined,
    custoEmbalagemTransporte: i.custoEmbalagemTransporte !== undefined ? Number(i.custoEmbalagemTransporte) : undefined,
    margem: i.margem !== undefined ? Number(i.margem) : margemPadrao,
    valorUnitario: Number(i.valorUnitario) || 0,
    valorAjustado: i.valorAjustado || false,
    total: Number(i.total) || 0,
  };
}

type ModoVisualizacao = "visualizacao" | "revisao";

export default function VisualizarOrcamento() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // ── Estado de edição (existente) ──
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [cienteAlteracao, setCienteAlteracao] = useState(false);
  const [modalFrete, setModalFrete] = useState(false);
  const [modalFreteProducao, setModalFreteProducao] = useState<string | null>(null);
  const [enderecoFornecedorModal, setEnderecoFornecedorModal] = useState("");

  // ── Novo estado: modo de visualização ──
  const [modo, setModo] = useState<ModoVisualizacao>("visualizacao");

  // ── Efeitos (existente) ──
  useEffect(() => {
    fetch(`/api/orcamentos/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const margem = data.margemPadrao ?? MARGEM_PADRAO;
        const percHon = data.percHonorarios ?? PERC_HONORARIOS_PADRAO;
        const percImp = data.percImpostos ?? PERC_IMPOSTOS_PADRAO;
        const percCom = data.percComissao ?? PERC_COMISSAO_PADRAO;
        const loaded = {
          ...data,
          margemPadrao: margem,
          percHonorarios: percHon,
          percImpostos: percImp,
          percComissao: percCom,
          itens: (data.itens || []).map((i: Partial<ItemOrcamento>) => migrarItem(i, margem)),
        };
        setOrcamento(loaded);
        const jaDifere =
          percHon !== PERC_HONORARIOS_PADRAO ||
          percImp !== PERC_IMPOSTOS_PADRAO ||
          percCom !== PERC_COMISSAO_PADRAO ||
          margem !== MARGEM_PADRAO;
        setCienteAlteracao(jaDifere);
      });
  }, [id]);

  useEffect(() => {
    if (!modalFreteProducao || !orcamento) { setEnderecoFornecedorModal(""); return; }
    const item = orcamento.itens.find((i) => i.id === modalFreteProducao);
    if (!item?.fornecedorId) return;
    fetch(`/api/fornecedores/${item.fornecedorId}`)
      .then((r) => r.json())
      .then((f: Fornecedor) => {
        const addr = [f.endereco, f.cidade, f.estado].filter(Boolean).join(", ");
        if (addr) setEnderecoFornecedorModal(addr);
      })
      .catch(() => {});
  }, [modalFreteProducao]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Funções (existente) ──
  function atualizarCampo(campo: keyof Orcamento, valor: string | number | boolean) {
    setSalvo(false);
    setOrcamento((prev) => prev ? { ...prev, [campo]: valor } : prev);
  }

  function margemExtraAtual(prev: Orcamento) {
    return (prev.percHonorarios || 0) + (prev.percImpostos || 0) + (prev.percComissao || 0);
  }

  function aplicarMargemPadraoATodos(novaMargemPadrao: number) {
    setSalvo(false);
    setCienteAlteracao(false);
    setOrcamento((prev) => {
      if (!prev) return prev;
      const me = margemExtraAtual(prev);
      return {
        ...prev,
        margemPadrao: novaMargemPadrao,
        itens: prev.itens.map((item) => {
          const novaMargemItem = item.margem >= prev.margemPadrao
            ? novaMargemPadrao
            : Math.min(item.margem, novaMargemPadrao);
          return recalcularItem({ ...item, margem: novaMargemItem, valorAjustado: false }, me);
        }),
      };
    });
  }

  function atualizarMargemExtra(campo: "percHonorarios" | "percImpostos" | "percComissao", valor: number) {
    setSalvo(false);
    setCienteAlteracao(false);
    setOrcamento((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [campo]: valor };
      const me = margemExtraAtual(updated);
      return {
        ...updated,
        itens: prev.itens.map((item) => recalcularItem(item, me)),
      };
    });
  }

  function atualizarItem(itemId: string, campo: keyof ItemOrcamento, valor: string | number | boolean | undefined) {
    setSalvo(false);
    setOrcamento((prev) => {
      if (!prev) return prev;
      const me = margemExtraAtual(prev);
      return {
        ...prev,
        itens: prev.itens.map((item) => {
          if (item.id !== itemId) return item;
          const atualizado = { ...item, [campo]: valor };
          if (campo === "valorUnitario") {
            atualizado.valorAjustado = true;
            atualizado.total = Number(valor) * (atualizado.quantidade || 0);
            return atualizado;
          }
          return recalcularItem(atualizado, me);
        }),
      };
    });
  }

  function resetarValorItem(itemId: string) {
    setSalvo(false);
    setOrcamento((prev) => {
      if (!prev) return prev;
      const me = margemExtraAtual(prev);
      return {
        ...prev,
        itens: prev.itens.map((item) =>
          item.id !== itemId ? item : recalcularItem({ ...item, valorAjustado: false }, me)
        ),
      };
    });
  }

  function adicionarItem() {
    setSalvo(false);
    setOrcamento((prev) => prev ? {
      ...prev,
      itens: [...prev.itens, itemVazio(prev.margemPadrao)],
    } : prev);
  }

  function removerItem(itemId: string) {
    setSalvo(false);
    setOrcamento((prev) => prev ? { ...prev, itens: prev.itens.filter((i) => i.id !== itemId) } : prev);
  }

  async function salvar() {
    if (!orcamento) return;
    if (percentuaisAlterados && !cienteAlteracao) {
      alert("Confirme a caixa 'Estou ciente da alteração nas porcentagens' na seção de Margens antes de salvar.");
      return;
    }
    setSalvando(true);
    try {
      await fetch(`/api/orcamentos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orcamento),
      });
      setSalvo(true);
    } catch {
      alert("Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function gerarPdf(tipo: "especificacoes" | "valores" | "os") {
    setGerandoPdf(true);
    try {
      const res = await fetch(`/api/pdf/${id}?tipo=${tipo}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = tipo === "os"
        ? `os-${orcamento?.numero}.pdf`
        : `orcamento-${orcamento?.numero}-${tipo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erro ao gerar PDF.");
    } finally {
      setGerandoPdf(false);
    }
  }

  async function deletar() {
    if (!confirm("Deletar este orçamento permanentemente?")) return;
    await fetch(`/api/orcamentos/${id}`, { method: "DELETE" });
    router.push("/orcamentos");
  }

  // ── Variáveis derivadas ──
  if (!orcamento) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>
  );

  const margemExtra = (orcamento.percHonorarios || 0) + (orcamento.percImpostos || 0) + (orcamento.percComissao || 0);
  const percentuaisAlterados =
    (orcamento.percHonorarios ?? PERC_HONORARIOS_PADRAO) !== PERC_HONORARIOS_PADRAO ||
    (orcamento.percImpostos ?? PERC_IMPOSTOS_PADRAO) !== PERC_IMPOSTOS_PADRAO ||
    (orcamento.percComissao ?? PERC_COMISSAO_PADRAO) !== PERC_COMISSAO_PADRAO ||
    orcamento.margemPadrao !== MARGEM_PADRAO;
  const totalProdutos = orcamento.itens.reduce((a, i) => a + (i.total || 0), 0);
  const totalServicos = orcamento.manuseio && orcamento.custoManuseio ? orcamento.custoManuseio : 0;
  const totalGeral = totalProdutos + totalServicos;
  const freteInfo = orcamento.frete && !orcamento.frete.startsWith("CUSTO ADICIONAL") ? orcamento.frete : null;
  const freteValorNum = (freteInfo && (orcamento.freteValor ?? 0) > 0) ? (orcamento.freteValor ?? 0) : 0;
  const totalComFrete = freteValorNum > 0 ? totalGeral + freteValorNum : 0;
  const ehNFSE = (orcamento.tiposNota || []).includes("NFSE");

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-6xl">
        {/* Cabeçalho com informações fixas */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Orçamento #{orcamento.numero}</h1>
            <p className="text-gray-500 text-sm">{orcamento.cliente || "Sem cliente"} · {orcamento.dataOrcamento}</p>
          </div>
          <div className="flex gap-2 items-center">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${STATUS_CONFIG[orcamento.status || "Em andamento"].bg} ${STATUS_CONFIG[orcamento.status || "Em andamento"].cor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[orcamento.status || "Em andamento"].dot}`} />
              {orcamento.status || "Em andamento"}
            </span>
            <button onClick={() => gerarPdf("valores")} disabled={gerandoPdf} className="bg-gray-800 text-white text-xs font-semibold py-1.5 px-3 rounded-lg hover:bg-gray-700 transition disabled:opacity-50">
              ⬇ Download PDF
            </button>
            <button
              onClick={deletar}
              className="text-xs font-semibold py-1.5 px-3 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 border border-red-200 hover:border-red-300 transition"
              title="Excluir orçamento"
            >
              <svg className="w-3.5 h-3.5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Excluir
            </button>
          </div>
        </div>

        {/* Abas: Visualização | Revisão */}
        <div className="flex gap-1 mb-5 border-b border-gray-200">
          <button
            onClick={() => setModo("visualizacao")}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition ${
              modo === "visualizacao"
                ? "border-[#fb4d06] text-[#fb4d06]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Visualização do Documento
          </button>
          <button
            onClick={() => setModo("revisao")}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition ${
              modo === "revisao"
                ? "border-[#fb4d06] text-[#fb4d06]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Revisão / Edição
          </button>
        </div>

        {/* ═══════════════════════════════════════════════
           MODO: VISUALIZAÇÃO (Documento Vivo Editável)
           ═══════════════════════════════════════════════ */}
        {modo === "visualizacao" ? (
          <DocumentoPreview
            orcamento={orcamento}
            onUpdateCampo={atualizarCampo}
            onUpdateItem={atualizarItem}
            onDownloadPdf={() => gerarPdf("valores")}
            gerandoPdf={gerandoPdf}
          />
        ) : (
          /* ════════════════════════════════════════════════
             MODO: REVISÃO / EDIÇÃO
             ════════════════════════════════════════════════ */
          <>
            {/* Botão voltar */}
            <div className="mb-4">
              <button
                onClick={() => setModo("visualizacao")}
                className="text-sm text-gray-500 hover:text-[#fb4d06] transition flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Voltar para Visualização
              </button>
            </div>

            {/* Barra de ações */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex gap-2 flex-wrap items-center">
                {/* Status dropdown */}
                <div className="relative group">
                  <button className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${STATUS_CONFIG[orcamento.status || "Em andamento"].bg} ${STATUS_CONFIG[orcamento.status || "Em andamento"].cor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[orcamento.status || "Em andamento"].dot}`} />
                    {orcamento.status || "Em andamento"}
                    <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute z-20 top-full mt-1 right-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px] hidden group-focus-within:block group-hover:block">
                    {TODOS_STATUS.map((s) => (
                      <button key={s}
                        onClick={() => atualizarCampo("status", s)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${s === (orcamento.status || "Em andamento") ? "font-bold" : ""}`}>
                        <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s].dot}`} />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <PedidoComprasAnexo
                  orcamentoId={id}
                  documentos={orcamento.documentos || []}
                  onUpdate={(docs: DocumentoFornecedor[]) =>
                    setOrcamento((prev) => prev ? { ...prev, documentos: docs } : prev)
                  }
                />
                {salvo && <span className="text-green-600 text-sm font-medium">✓ Salvo</span>}
                <button
                  onClick={salvar}
                  disabled={salvando}
                  className="bg-green-600 text-white text-sm font-semibold py-2 px-5 rounded-xl hover:bg-green-700 transition disabled:opacity-50"
                >
                  {salvando ? "Salvando..." : "Salvar alterações"}
                </button>
                <button
                  onClick={() => gerarPdf("os")}
                  disabled={gerandoPdf}
                  className="bg-gray-800 text-white text-sm font-semibold py-2 px-4 rounded-xl hover:bg-gray-700 transition disabled:opacity-50"
                >
                  {gerandoPdf ? "Gerando..." : "OS"}
                </button>
                <button
                  onClick={() => gerarPdf("especificacoes")}
                  disabled={gerandoPdf}
                  className="bg-white border border-[#fb4d06]/30 text-[#fb4d06] text-sm font-semibold py-2 px-4 rounded-xl hover:bg-[#fb4d06]/5 transition disabled:opacity-50"
                >
                  PDF Especificações
                </button>
                <button
                  onClick={() => gerarPdf("valores")}
                  disabled={gerandoPdf}
                  className="bg-[#fb4d06] text-white text-sm font-semibold py-2 px-4 rounded-xl hover:opacity-90 transition disabled:opacity-50"
                >
                  {gerandoPdf ? "Gerando..." : "PDF Valores"}
                </button>
                <button onClick={deletar} className="text-sm text-red-400 hover:text-red-600 px-2 py-2">
                  Excluir
                </button>
              </div>
            </div>

            {/* Informações gerais */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Informações Gerais</h2>

              {/* Linha 1: Nº + Projeto + Cliente + Solicitante */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nº Orçamento</label>
                  <div className="border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm font-bold text-[#fb4d06]">
                    {orcamento.numero}
                  </div>
                </div>
                <Campo label="Nome do Projeto" value={orcamento.nomeProjeto || ""} onChange={(v) => atualizarCampo("nomeProjeto", v)} />
                <Campo label="Cliente" value={orcamento.cliente} onChange={(v) => atualizarCampo("cliente", v)} />
                <Campo label="Solicitante" value={orcamento.solicitante} onChange={(v) => atualizarCampo("solicitante", v)} />
              </div>

              {/* Linha 2: Responsável + Data solicitação + Data elaboração + Tipo nota */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <Campo label="Responsável pelo orçamento" value={orcamento.responsavel || ""} onChange={(v) => atualizarCampo("responsavel", v)} />
                <CampoData
                  label="Data da solicitação"
                  value={orcamento.dataSolicitacao || ""}
                  onChange={(v) => atualizarCampo("dataSolicitacao", v)}
                />
                <CampoData
                  label="Data da elaboração"
                  value={orcamento.dataOrcamento}
                  onChange={(v) => atualizarCampo("dataOrcamento", v)}
                  autoFilled
                />
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de nota</label>
                  <div className="flex gap-2">
                    {(["DANFE", "NFSE"] as const).map((tipo) => {
                      const ativo = (orcamento.tiposNota || []).includes(tipo);
                      return (
                        <button key={tipo} type="button"
                          onClick={() => {
                            const atual = orcamento.tiposNota || [];
                            atualizarCampo("tiposNota" as keyof typeof orcamento, (ativo ? atual.filter((t) => t !== tipo) : [...atual, tipo]) as unknown as string);
                          }}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${
                            ativo ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                          }`}>
                          {tipo}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Linha 3: Prazos */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <CampoPrazoPagamento
                  value={orcamento.prazoPagamento}
                  onChange={(v) => atualizarCampo("prazoPagamento", v)}
                />
                <CampoPrazoEntrega
                  value={orcamento.prazoEntrega}
                  onChange={(v) => atualizarCampo("prazoEntrega", v)}
                  sugestaoDias={(() => {
                    const vals = orcamento.itens.map((i) => i.diasProducao || 0).filter((d) => d > 0);
                    return vals.length ? Math.max(...vals) : null;
                  })()}
                />
              </div>

              {/* Linha 4: Observações + Frete */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-red-600 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                    value={orcamento.observacoes}
                    onChange={(e) => atualizarCampo("observacoes", e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-500">Frete</label>
                    <button
                      type="button"
                      onClick={() => setModalFrete(true)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#fb4d06] hover:underline"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Calculadora
                    </button>
                  </div>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                    value={orcamento.frete}
                    onChange={(e) => atualizarCampo("frete", e.target.value)}
                  />
                </div>
              </div>

              {/* Manuseio */}
              <div className="mt-4 border border-gray-100 rounded-xl p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Manuseio específico</p>
                    <p className="text-xs text-gray-400 mt-0.5">Será tratado como serviço · NF-e de Serviço</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => atualizarCampo("manuseio", !orcamento.manuseio)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${orcamento.manuseio ? "bg-[#fb4d06]" : "bg-gray-200"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${orcamento.manuseio ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                {orcamento.manuseio && (
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Custo do manuseio (R$)</label>
                      <input
                        type="number" min={0} step="0.01"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
                        value={orcamento.custoManuseio || ""}
                        onChange={(e) => atualizarCampo("custoManuseio", parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    {!!orcamento.custoManuseio && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Valor do serviço</p>
                        <p className="text-base font-bold text-gray-700">
                          R$ {(orcamento.custoManuseio).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Margens do Orçamento */}
            <div className="bg-[#fb4d06]/5 border border-[#fb4d06]/20 rounded-2xl p-5 mb-6">
              <div className="mb-4">
                <h2 className="text-sm font-bold text-[#fb4d06] mb-0.5">Margens do Orçamento</h2>
                <p className="text-xs text-[#fb4d06]/70">Definem o preço final de todos os itens. A margem de lucro pode ser reduzida individualmente por item.</p>
              </div>
              <div className="flex flex-wrap gap-5 items-end">
                {(["percHonorarios", "percImpostos", "percComissao"] as const).map((campo) => (
                  <div key={campo} className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-[#fb4d06]/70 whitespace-nowrap">
                      {campo === "percHonorarios" ? "Honorários" : campo === "percImpostos" ? "Impostos" : "Comissão"}
                    </label>
                    <div className="relative">
                      <input type="number" min={0} max={100} step="0.1"
                        className="w-24 border border-[#fb4d06]/20 rounded-lg px-3 py-2 pr-7 text-sm text-[#fb4d06] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 text-center"
                        value={orcamento[campo] ?? ""}
                        onChange={(e) => atualizarMargemExtra(campo, parseFloat(e.target.value) || 0)}
                        placeholder="0" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#fb4d06]/50 pointer-events-none">%</span>
                    </div>
                  </div>
                ))}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#fb4d06]/90 whitespace-nowrap">Margem de Lucro</label>
                  <div className="relative">
                    <input type="number" min={0} max={99}
                      className="w-24 border-2 border-[#fb4d06]/40 rounded-lg px-3 py-2 pr-7 text-sm text-[#fb4d06] font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/40 text-center"
                      value={orcamento.margemPadrao}
                      onChange={(e) => aplicarMargemPadraoATodos(Number(e.target.value))} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#fb4d06]/50 pointer-events-none">%</span>
                  </div>
                </div>
              </div>
              {(() => {
                const totalMargem = orcamento.margemPadrao + margemExtra;
                return (
                  <p className="mt-3 text-xs text-[#fb4d06]/60">
                    = <span className="font-semibold text-[#fb4d06]/80">{totalMargem.toFixed(1)}%</span> total
                    {totalMargem < 100 && <> · Markup equivalente: <span className="font-semibold">{(100 / (1 - totalMargem / 100) - 100).toFixed(1)}%</span></>}
                  </p>
                );
              })()}
              {percentuaisAlterados && (
                <label className="flex items-start gap-2.5 mt-3 pt-3 border-t border-[#fb4d06]/15 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={cienteAlteracao}
                    onChange={(e) => setCienteAlteracao(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#fb4d06] cursor-pointer shrink-0"
                  />
                  <span className={`text-xs font-semibold ${cienteAlteracao ? "text-[#fb4d06]/70" : "text-amber-700"}`}>
                    Estou ciente da alteração nas porcentagens.
                  </span>
                </label>
              )}
            </div>

            {/* Itens */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Itens do Orçamento</h2>

              <div className="flex flex-col gap-5">
                {orcamento.itens.map((item, idx) => {
                  const custoTotal = calcularCustoTotal(item);
                  const valorSugerido = calcularValorSugerido(item, margemExtra);
                  const margemReal = calcularMargemReal(custoTotal, item.valorUnitario);

                  return (
                    <div key={item.id} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b border-gray-100">
                        <span className="text-xs font-bold text-[#fb4d06] uppercase">Item {idx + 1}</span>
                        {orcamento.itens.length > 1 && (
                          <button onClick={() => removerItem(item.id)} className="text-red-400 hover:text-red-600 text-xs">
                            Remover
                          </button>
                        )}
                      </div>

                      <div className="p-4 flex flex-col gap-4">
                        {ehNFSE ? (
                          /* ═══ NFSE — Serviço ═══ */
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <Campo label="Item" value={item.item} onChange={(v) => atualizarItem(item.id, "item", v)} />
                              <CampoNumero label="Período (dias)" value={item.diasProducao || 0} onChange={(v) => atualizarItem(item.id, "diasProducao", v)} />
                              <CampoNumero label="Quantidade" value={item.quantidade} onChange={(v) => atualizarItem(item.id, "quantidade", v)} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Descrição</label>
                              <textarea
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none min-h-[70px] focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                                value={item.descricao}
                                onChange={(e) => atualizarItem(item.id, "descricao", e.target.value)}
                              />
                            </div>
                            <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                              <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-3">Valores do Serviço</p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-purple-600 mb-1">Custo Unitário (R$)</label>
                                  <input type="number" min={0} step="0.01"
                                    className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm text-purple-700 font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    value={item.custoUnitario || ""}
                                    onChange={(e) => atualizarItem(item.id, "custoUnitario", Number(e.target.value))}
                                    placeholder="0,00"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-purple-600 mb-1">Margem (%)</label>
                                  <input type="number" min={0} max={99} step={0.5}
                                    className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm text-purple-700 font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    value={item.margem ?? orcamento.margemPadrao}
                                    onChange={(e) => atualizarItem(item.id, "margem", Number(e.target.value))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-purple-600 mb-1">Valor Unit. Sugerido (R$)</label>
                                  <input type="number" min={0} step="0.01"
                                    className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm text-purple-700 font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    value={item.valorUnitario || ""}
                                    onChange={(e) => atualizarItem(item.id, "valorUnitario", Number(e.target.value))}
                                    placeholder="0,00"
                                  />
                                  {!item.valorAjustado && item.valorUnitario > 0 && (
                                    <p className="text-[10px] text-purple-400 mt-0.5">Automático</p>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-purple-600 mb-1">Valor Total (R$)</label>
                                  <div className="text-lg font-bold text-purple-700 py-2">
                                    R$ {item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          /* ═══ DANFE — Produto ═══ */
                          <>
                            {/* Dados do produto */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <Campo label="Kit" value={item.kit} onChange={(v) => atualizarItem(item.id, "kit", v)} />
                          <Campo label="Item / Produto" value={item.item} onChange={(v) => atualizarItem(item.id, "item", v)} />
                          <Campo label="Cor" value={item.cor || ""} onChange={(v) => atualizarItem(item.id, "cor", v)} />
                          <Campo label="Referência / SKU" value={item.referencia} onChange={(v) => atualizarItem(item.id, "referencia", v)} />
                          <Campo label="NCM" value={item.ncm || ""} onChange={(v) => atualizarItem(item.id, "ncm", v)} />
                          <Campo label="Fornecedor" value={item.fornecedorNome || ""} onChange={(v) => atualizarItem(item.id, "fornecedorNome", v)} />
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Acabamento</label>
                            <select
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                              value={item.acabamento}
                              onChange={(e) => atualizarItem(item.id, "acabamento", e.target.value)}
                            >
                              {TIPOS.map((t) => <option key={t}>{t}</option>)}
                            </select>
                          </div>
                          <CampoNumero label="Quantidade" value={item.quantidade} onChange={(v) => atualizarItem(item.id, "quantidade", v)} />
                          <CampoNumero label="Prazo prod. (dias úteis)" value={item.diasProducao || 0} onChange={(v) => atualizarItem(item.id, "diasProducao", v)} />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Descrição Técnica</label>
                          <textarea
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none min-h-[70px] focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                            value={item.descricao}
                            onChange={(e) => atualizarItem(item.id, "descricao", e.target.value)}
                          />
                        </div>

                        {/* Precificação */}
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Precificação</p>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
                            <div>
                              <label className={`block text-xs font-medium mb-1 ${temSurchargeQtdMinima(item) ? "text-amber-600" : "text-gray-500"}`}>
                                Custo unit. fornecedor (R$)
                                {temSurchargeQtdMinima(item) && <span className="ml-1 font-bold">+5%</span>}
                              </label>
                              <input
                                type="number" min={0} step="0.01"
                                className={`w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 ${temSurchargeQtdMinima(item) ? "border-amber-300 text-amber-700 focus:ring-amber-300" : "border-gray-200 text-gray-700 focus:ring-[#fb4d06]/30"}`}
                                value={item.custoUnitario || ""}
                                onChange={(e) => atualizarItem(item.id, "custoUnitario", parseFloat(e.target.value) || 0)}
                                placeholder="0,00"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Qtd mínima fornecedor</label>
                              <input
                                type="number" min={0} step="1"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 text-gray-700"
                                value={item.quantidadeMinima || ""}
                                onChange={(e) => atualizarItem(item.id, "quantidadeMinima", parseInt(e.target.value) || 0)}
                                placeholder="Sem mínimo"
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-gray-500">Frete de produção total (R$)</label>
                                <button type="button" onClick={() => setModalFreteProducao(item.id)}
                                  className="flex items-center gap-1 text-[11px] font-semibold text-[#fb4d06] hover:underline">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                  </svg>
                                  Calcular
                                </button>
                              </div>
                              <input type="number" min={0} step="0.01"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                                value={item.freteProducao || ""}
                                onChange={(e) => atualizarItem(item.id, "freteProducao", parseFloat(e.target.value) || 0)}
                                placeholder="0,00" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Custo de personalização total (R$)</label>
                              <input type="number" min={0} step="0.01"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
                                value={item.custoPersonalizacao || ""}
                                onChange={(e) => atualizarItem(item.id, "custoPersonalizacao", parseFloat(e.target.value) || 0)}
                                placeholder="0,00" />
                              <p className="text-[10px] text-gray-400 mt-0.5">Total ÷ quantidade</p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Margem de Lucro (%)</label>
                              <input
                                type="number" min={0} max={orcamento.margemPadrao}
                                className="w-full border border-[#fb4d06]/20 rounded-lg px-3 py-2 text-sm text-[#fb4d06] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/40"
                                value={item.margem || ""}
                                onChange={(e) => atualizarItem(item.id, "margem", Math.min(Number(e.target.value), orcamento.margemPadrao))}
                              />
                              {item.margem < orcamento.margemPadrao && (
                                <p className="text-[10px] text-amber-600 mt-0.5">↓ reduzida · padrão: {orcamento.margemPadrao}%</p>
                              )}
                              {margemExtra > 0 && (
                                <p className="text-[10px] text-[#fb4d06]/60 mt-0.5">
                                  Total: {((item.margem || 0) + margemExtra).toFixed(1)}%
                                  {(orcamento.percHonorarios || 0) > 0 && ` · Hon. ${orcamento.percHonorarios}%`}
                                  {(orcamento.percImpostos || 0) > 0 && ` · Imp. ${orcamento.percImpostos}%`}
                                  {(orcamento.percComissao || 0) > 0 && ` · Com. ${orcamento.percComissao}%`}
                                </p>
                              )}
                            </div>
                          </div>
                          {/* Embalagem */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            <button
                              type="button"
                              onClick={() => atualizarItem(item.id, "custoEmbalagemIndividual", item.custoEmbalagemIndividual !== undefined ? undefined : 0)}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition flex items-center gap-1 ${item.custoEmbalagemIndividual !== undefined ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"}`}
                            >
                              + Embalagem Individual
                            </button>
                            <button
                              type="button"
                              onClick={() => atualizarItem(item.id, "custoEmbalagemTransporte", item.custoEmbalagemTransporte !== undefined ? undefined : 0)}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition flex items-center gap-1 ${item.custoEmbalagemTransporte !== undefined ? "bg-purple-50 border-purple-300 text-purple-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"}`}
                            >
                              + Embalagem Transporte
                            </button>
                          </div>
                          {(item.custoEmbalagemIndividual !== undefined || item.custoEmbalagemTransporte !== undefined) && (
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              {item.custoEmbalagemIndividual !== undefined && (
                                <div>
                                  <label className="block text-xs font-medium text-indigo-600 mb-1">Embalagem individual (R$ / item)</label>
                                  <input type="number" min={0} step="0.01"
                                    className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                                    value={item.custoEmbalagemIndividual || ""}
                                    onChange={(e) => atualizarItem(item.id, "custoEmbalagemIndividual", parseFloat(e.target.value) || 0)}
                                    placeholder="0,00" />
                                  <p className="text-[10px] text-indigo-400 mt-0.5">Custo por unidade, não dividido</p>
                                </div>
                              )}
                              {item.custoEmbalagemTransporte !== undefined && (
                                <div>
                                  <label className="block text-xs font-medium text-purple-600 mb-1">Embalagem transporte total (R$)</label>
                                  <input type="number" min={0} step="0.01"
                                    className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
                                    value={item.custoEmbalagemTransporte || ""}
                                    onChange={(e) => atualizarItem(item.id, "custoEmbalagemTransporte", parseFloat(e.target.value) || 0)}
                                    placeholder="0,00" />
                                  <p className="text-[10px] text-purple-400 mt-0.5">Total dividido pela quantidade</p>
                                </div>
                              )}
                            </div>
                          )}

                          {temSurchargeQtdMinima(item) && (
                            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                              </svg>
                              Quantidade ({item.quantidade}) abaixo do mínimo do fornecedor ({item.quantidadeMinima}) — +5% adicionado ao custo unitário automaticamente
                            </div>
                          )}

                          <div className="flex flex-wrap items-end gap-4 pt-3 border-t border-gray-200">
                            {custoTotal > 0 && (
                              <div className="text-xs text-gray-500">
                                Custo total unit.: <span className="font-semibold text-gray-700">R$ {custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            {valorSugerido > 0 && (
                              <div className="text-xs text-gray-500">
                                Preço sugerido: <span className="font-semibold text-green-700">R$ {valorSugerido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}

                            <div className="flex-1 min-w-[200px]">
                              <div className="flex items-center gap-2 mb-1">
                                <label className="text-xs font-medium text-gray-600">Preço final ao cliente (R$)</label>
                                {item.valorAjustado && (
                                  <button
                                    onClick={() => resetarValorItem(item.id)}
                                    className="text-xs text-blue-500 hover:text-blue-700 underline"
                                  >
                                    Usar calculado
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                className={`w-full border-2 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/40 ${item.valorAjustado ? "border-orange-300 text-orange-700" : "border-[#fb4d06]/30 text-[#fb4d06]"}`}
                                value={item.valorUnitario || ""}
                                onChange={(e) => atualizarItem(item.id, "valorUnitario", Number(e.target.value))}
                                placeholder={valorSugerido > 0 ? valorSugerido.toFixed(2) : "0,00"}
                              />
                              {item.valorAjustado && item.valorUnitario > 0 && custoTotal > 0 && (
                                <p className="text-xs mt-1 text-orange-600">
                                  Margem real: {margemReal.toFixed(1)}% {margemReal < item.margem ? "↓ abaixo do padrão" : "↑ acima"}
                                </p>
                              )}
                            </div>

                            <div className="text-right">
                              <p className="text-xs text-gray-400">Total do item</p>
                              <p className="text-lg font-bold text-[#fb4d06]">
                                R$ {item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>              {/* fecha flex-wrap preço final */}
                        </div>                {/* fecha bg-gray-50 precificação */}
                        </>
                      )}
                      </div>                  {/* fecha p-4 flex-col gap-4 */}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={adicionarItem}
                className="mt-4 w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-[#fb4d06]/30 hover:text-[#fb4d06] transition"
              >
                + Adicionar item
              </button>
            </div>

            {/* Total + salvar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex flex-col gap-2">
                    {orcamento.manuseio && !!orcamento.custoManuseio && (
                      <>
                        <div className="flex justify-between items-center text-sm text-gray-500">
                          <span>Total Produtos</span>
                          <span className="font-semibold text-gray-700">R$ {totalProdutos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-500">
                          <span>Total Serviços <span className="text-xs text-purple-500">(Manuseio · NFSE)</span></span>
                          <span className="font-semibold text-purple-700">R$ {totalServicos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    )}
                    <div className={`flex justify-between items-center ${(orcamento.manuseio && !!orcamento.custoManuseio) || totalComFrete > 0 ? "border-t border-gray-100 pt-2" : ""}`}>
                      <span className={totalComFrete > 0 ? "text-sm text-gray-500" : "font-semibold text-gray-700"}>
                        {totalComFrete > 0 ? "Subtotal (sem frete)" : "Total Geral"}
                      </span>
                      <span className={totalComFrete > 0 ? "font-semibold text-gray-700 text-sm" : "text-2xl font-bold text-[#fb4d06]"}>
                        R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {freteInfo && freteValorNum > 0 && (
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <span>Frete de entrega</span>
                        <span className="font-semibold text-blue-700">R$ {freteValorNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {totalComFrete > 0 && (
                      <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                        <span className="font-semibold text-gray-700">Total com Frete</span>
                        <p className="text-2xl font-bold text-[#fb4d06]">R$ {totalComFrete.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    )}
                    {freteInfo && freteValorNum === 0 && (
                      <div className="mt-1 pt-3 border-t border-dashed border-gray-200 flex justify-between items-center text-sm">
                        <span className="text-gray-500">Frete de entrega</span>
                        <span className="font-semibold text-blue-700">{freteInfo}</span>
                      </div>
                    )}
                  </div>

                  {/* Honorários e Impostos — ativação */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => atualizarCampo("mostrarHonorarios", !orcamento.mostrarHonorarios)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                        orcamento.mostrarHonorarios
                          ? "bg-gray-800 text-white border-gray-800"
                          : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {orcamento.mostrarHonorarios ? "✓ " : ""}Exibir Honorários e Impostos na proposta
                    </button>

                    {orcamento.mostrarHonorarios && (
                      <div className="mt-3">
                        {((orcamento.percHonorarios ?? 0) > 0 || (orcamento.percImpostos ?? 0) > 0) ? (
                          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-1.5">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Composição do Total Geral</p>
                            {(orcamento.percHonorarios ?? 0) > 0 && (
                              <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>Honorários <span className="text-gray-400">({orcamento.percHonorarios}%)</span></span>
                                <span className="font-semibold text-gray-800">
                                  R$ {(totalGeral * (orcamento.percHonorarios ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                            {(orcamento.percImpostos ?? 0) > 0 && (
                              <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>Impostos <span className="text-gray-400">({orcamento.percImpostos}%)</span></span>
                                <span className="font-semibold text-gray-800">
                                  R$ {(totalGeral * (orcamento.percImpostos ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-gray-400">Configure os percentuais no campo Honorários e Impostos acima.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={salvar}
                  disabled={salvando}
                  className="bg-green-600 text-white font-semibold py-3 px-8 rounded-xl hover:bg-green-700 transition disabled:opacity-50 self-start"
                >
                  {salvando ? "Salvando..." : salvo ? "✓ Salvo" : "Salvar alterações"}
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {modalFrete && (
        <CalculadoraFrete
          clienteId={orcamento.clienteId}
          onAplicar={(v, n) => { atualizarCampo("frete", v); atualizarCampo("freteValor", n ?? 0); setSalvo(false); setModalFrete(false); }}
          onFechar={() => setModalFrete(false)}
        />
      )}

      {modalFreteProducao && (() => {
        const itemAtual = orcamento.itens.find((i) => i.id === modalFreteProducao);
        if (!itemAtual) return null;
        return (
          <CalculadoraFrete
            enderecoOrigem={enderecoFornecedorModal}
            onAplicar={() => setModalFreteProducao(null)}
            onAplicarNumerico={(total) => { atualizarItem(modalFreteProducao, "freteProducao", total); setSalvo(false); setModalFreteProducao(null); }}
            onFechar={() => setModalFreteProducao(null)}
            quantidadeItens={itemAtual.quantidade || undefined}
          />
        );
      })()}
    </WorkspaceLayout>
  );
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CampoNumero({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
