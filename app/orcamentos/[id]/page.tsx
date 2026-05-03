"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Orcamento, ItemOrcamento, StatusOrcamento } from "@/app/types";
import { STATUS_CONFIG } from "@/app/types";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import { calcularCustoTotal, calcularValorSugerido, calcularMargemReal, recalcularItem } from "@/lib/calculos";

const TODOS_STATUS = Object.keys(STATUS_CONFIG) as StatusOrcamento[];

const TIPOS = ["Silk", "DTF", "Bordado", "Laser", "Verniz UV", "Tampografia", "Sublimação", "Gravação em relevo", "Outro"];

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

function itemVazio(margem: number): ItemOrcamento {
  return {
    id: gerarId(), kit: "", referencia: "", item: "", acabamento: "Silk", descricao: "",
    quantidade: 0, custoUnitario: 0, freteProducao: 0, custoArte: 0,
    margem, valorUnitario: 0, valorAjustado: false, total: 0,
  };
}

function migrarItem(i: Partial<ItemOrcamento>, margemPadrao: number): ItemOrcamento {
  return {
    id: i.id || gerarId(),
    kit: i.kit || "", referencia: i.referencia || "", item: i.item || "",
    acabamento: i.acabamento || "Silk", descricao: i.descricao || "",
    quantidade: Number(i.quantidade) || 0,
    custoUnitario: Number(i.custoUnitario) || 0,
    freteProducao: Number(i.freteProducao) || 0,
    custoArte: Number(i.custoArte) || 0,
    margem: i.margem !== undefined ? Number(i.margem) : margemPadrao,
    valorUnitario: Number(i.valorUnitario) || 0,
    valorAjustado: i.valorAjustado || false,
    total: Number(i.total) || 0,
  };
}

export default function VisualizarOrcamento() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  useEffect(() => {
    fetch(`/api/orcamentos/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const margem = data.margemPadrao ?? 40;
        setOrcamento({
          ...data,
          margemPadrao: margem,
          itens: (data.itens || []).map((i: Partial<ItemOrcamento>) => migrarItem(i, margem)),
        });
      });
  }, [id]);

  function atualizarCampo(campo: keyof Orcamento, valor: string | number) {
    setSalvo(false);
    setOrcamento((prev) => prev ? { ...prev, [campo]: valor } : prev);
  }

  function aplicarMargemPadraoATodos(novaMargemPadrao: number) {
    setSalvo(false);
    setOrcamento((prev) => prev ? {
      ...prev,
      margemPadrao: novaMargemPadrao,
      itens: prev.itens.map((item) => recalcularItem({ ...item, margem: novaMargemPadrao, valorAjustado: false })),
    } : prev);
  }

  function atualizarItem(itemId: string, campo: keyof ItemOrcamento, valor: string | number | boolean) {
    setSalvo(false);
    setOrcamento((prev) => {
      if (!prev) return prev;
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
          return recalcularItem(atualizado);
        }),
      };
    });
  }

  function resetarValorItem(itemId: string) {
    setSalvo(false);
    setOrcamento((prev) => prev ? {
      ...prev,
      itens: prev.itens.map((item) =>
        item.id !== itemId ? item : recalcularItem({ ...item, valorAjustado: false })
      ),
    } : prev);
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

  async function gerarPdf(tipo: "especificacoes" | "valores") {
    setGerandoPdf(true);
    try {
      const res = await fetch(`/api/pdf/${id}?tipo=${tipo}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orcamento-${orcamento?.numero}-${tipo}.pdf`;
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

  if (!orcamento) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>
  );

  const totalGeral = orcamento.itens.reduce((a, i) => a + (i.total || 0), 0);

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-5xl">

        {/* Barra de ações */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Orçamento #{orcamento.numero}</h1>
            <p className="text-gray-500 text-sm">{orcamento.cliente || "Sem cliente"} · {orcamento.dataOrcamento}</p>
          </div>
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
            {salvo && <span className="text-green-600 text-sm font-medium">✓ Salvo</span>}
            <button
              onClick={salvar}
              disabled={salvando}
              className="bg-green-600 text-white text-sm font-semibold py-2 px-5 rounded-xl hover:bg-green-700 transition disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar alterações"}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nº Orçamento</label>
              <div className="border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm font-bold text-[#fb4d06]">
                {orcamento.numero}
              </div>
            </div>
            <Campo label="Cliente" value={orcamento.cliente} onChange={(v) => atualizarCampo("cliente", v)} />
            <Campo label="Solicitante" value={orcamento.solicitante} onChange={(v) => atualizarCampo("solicitante", v)} />
            <Campo label="Data do Orçamento" value={orcamento.dataOrcamento} onChange={(v) => atualizarCampo("dataOrcamento", v)} />
            <Campo label="Prazo de Pagamento" value={orcamento.prazoPagamento} onChange={(v) => atualizarCampo("prazoPagamento", v)} />
            <Campo label="Prazo de Entrega" value={orcamento.prazoEntrega} onChange={(v) => atualizarCampo("prazoEntrega", v)} />
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-red-600 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                value={orcamento.observacoes}
                onChange={(e) => atualizarCampo("observacoes", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Frete</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                value={orcamento.frete}
                onChange={(e) => atualizarCampo("frete", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Margem padrão */}
        <div className="bg-[#fb4d06]/5 border border-[#fb4d06]/20 rounded-2xl p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-[#fb4d06] mb-0.5">Margem Padrão do Orçamento</h2>
            <p className="text-xs text-[#fb4d06]">Altera a margem de todos os itens sem ajuste manual.</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number" min={0} max={99}
              className="w-24 border border-[#fb4d06]/30 rounded-lg px-3 py-2 text-sm font-bold text-[#fb4d06] bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/40 text-center"
              value={orcamento.margemPadrao}
              onChange={(e) => aplicarMargemPadraoATodos(Number(e.target.value))}
            />
            <span className="text-[#fb4d06] font-bold">%</span>
            <span className="text-xs text-[#fb4d06]/80">
              Markup: {orcamento.margemPadrao < 100 ? (100 / (1 - orcamento.margemPadrao / 100) - 100).toFixed(1) : "∞"}%
            </span>
          </div>
        </div>

        {/* Itens */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Itens do Orçamento</h2>

          <div className="flex flex-col gap-5">
            {orcamento.itens.map((item, idx) => {
              const custoTotal = calcularCustoTotal(item);
              const valorSugerido = calcularValorSugerido(item);
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
                    {/* Dados do produto */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <Campo label="Kit" value={item.kit} onChange={(v) => atualizarItem(item.id, "kit", v)} />
                      <Campo label="Referência" value={item.referencia} onChange={(v) => atualizarItem(item.id, "referencia", v)} />
                      <Campo label="Item / Produto" value={item.item} onChange={(v) => atualizarItem(item.id, "item", v)} />
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
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <CampoNumero label="Custo unit. fornecedor (R$)" value={item.custoUnitario} onChange={(v) => atualizarItem(item.id, "custoUnitario", v)} />
                        <CampoNumero label="Frete produção total (R$)" value={item.freteProducao} onChange={(v) => atualizarItem(item.id, "freteProducao", v)} />
                        <CampoNumero label="Custo de arte (R$)" value={item.custoArte} onChange={(v) => atualizarItem(item.id, "custoArte", v)} />
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Margem (%)</label>
                          <input
                            type="number" min={0} max={99}
                            className="w-full border border-[#fb4d06]/20 rounded-lg px-3 py-2 text-sm text-[#fb4d06] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/40"
                            value={item.margem || ""}
                            onChange={(e) => atualizarItem(item.id, "margem", Number(e.target.value))}
                          />
                        </div>
                      </div>

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
                      </div>
                    </div>
                  </div>
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
          <div>
            <span className="font-semibold text-gray-700">Total Geral</span>
            <p className="text-2xl font-bold text-[#fb4d06] mt-0.5">
              R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <button
            onClick={salvar}
            disabled={salvando}
            className="bg-green-600 text-white font-semibold py-3 px-8 rounded-xl hover:bg-green-700 transition disabled:opacity-50"
          >
            {salvando ? "Salvando..." : salvo ? "✓ Salvo" : "Salvar alterações"}
          </button>
        </div>
      </main>
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
