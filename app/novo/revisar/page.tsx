"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ItemOrcamento, Orcamento, Cliente, Produto } from "@/app/types";
import { calcularCustoTotal, calcularValorSugerido, calcularMargemReal, recalcularItem } from "@/lib/calculos";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import ComboboxCliente from "@/app/components/ComboboxCliente";
import SeletorProduto from "@/app/components/SeletorProduto";

const TIPOS = ["Silk", "DTF", "Bordado", "Laser", "Verniz UV", "Tampografia", "Sublimação", "Gravação em relevo", "Outro"];
const MARGEM_PADRAO = 40;

function gerarId() {
  return Math.random().toString(36).substring(2, 10);
}

function itemVazio(margem: number): ItemOrcamento {
  return {
    id: gerarId(),
    kit: "", referencia: "", item: "", acabamento: "Silk", descricao: "",
    quantidade: 0, custoUnitario: 0, freteProducao: 0, custoArte: 0,
    margem, valorUnitario: 0, valorAjustado: false, total: 0,
  };
}

export default function RevisarOrcamento() {
  const router = useRouter();
  const [orcamento, setOrcamento] = useState<Omit<Orcamento, "id" | "createdAt">>({
    numero: "", cliente: "", solicitante: "",
    dataOrcamento: new Date().toLocaleDateString("pt-BR"),
    prazoPagamento: "à combinar",
    prazoEntrega: "30 dias após aprovação",
    observacoes: "Valores válidos por 7 dias. Após esse prazo, consultar",
    frete: "CUSTO ADICIONAL - ORÇADO APÓS O ENVIO DA PLANILHA DE ENDEREÇOS DE ENTREGA PARA TODO O BRASIL",
    margemPadrao: MARGEM_PADRAO,
    status: "Em andamento" as const,
    itens: [itemVazio(MARGEM_PADRAO)],
  });
  const [salvando, setSalvando] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  useEffect(() => {
    fetch("/api/produtos").then((r) => r.json()).then(setProdutos);
  }, []);

  useEffect(() => {
    fetch("/api/numero")
      .then((r) => r.json())
      .then(({ numero }) => setOrcamento((prev) => ({ ...prev, numero })));

    const rascunho = sessionStorage.getItem("orcamento_rascunho");
    if (rascunho) {
      const dados = JSON.parse(rascunho);
      setOrcamento((prev) => ({
        ...prev,
        cliente: dados.cliente || "",
        solicitante: dados.solicitante || "",
        prazoPagamento: dados.prazoPagamento || "à combinar",
        prazoEntrega: dados.prazoEntrega || "30 dias após aprovação",
        observacoes: dados.observacoes || prev.observacoes,
        frete: dados.frete || prev.frete,
        itens: dados.itens?.length
          ? dados.itens.map((i: Partial<ItemOrcamento>) => {
              const item: ItemOrcamento = {
                id: gerarId(),
                kit: i.kit || "", referencia: i.referencia || "",
                item: i.item || "", acabamento: i.acabamento || "Silk",
                descricao: i.descricao || "",
                quantidade: Number(i.quantidade) || 0,
                custoUnitario: 0, freteProducao: 0, custoArte: 0,
                margem: MARGEM_PADRAO,
                valorUnitario: 0, valorAjustado: false, total: 0,
              };
              return item;
            })
          : [itemVazio(MARGEM_PADRAO)],
      }));
      sessionStorage.removeItem("orcamento_rascunho");
    }
  }, []);

  function atualizarCampo(campo: keyof typeof orcamento, valor: string | number) {
    setOrcamento((prev) => ({ ...prev, [campo]: valor }));
  }

  function selecionarCliente(c: Cliente) {
    setOrcamento((prev) => ({
      ...prev,
      cliente: c.nomeEmpresa || c.razaoSocial,
      solicitante: c.nomeContato || prev.solicitante,
    }));
  }

  function selecionarProduto(itemId: string, p: Produto) {
    setOrcamento((prev) => ({
      ...prev,
      itens: prev.itens.map((item) => {
        if (item.id !== itemId) return item;
        return recalcularItem({
          ...item,
          item: p.nome,
          referencia: p.sku,
          custoUnitario: p.precoCusto || 0,
          descricao: p.informacaoTecnica || "",
        });
      }),
    }));
  }

  function aplicarMargemPadraoATodos(novaMargemPadrao: number) {
    setOrcamento((prev) => ({
      ...prev,
      margemPadrao: novaMargemPadrao,
      itens: prev.itens.map((item) => recalcularItem({ ...item, margem: novaMargemPadrao, valorAjustado: false })),
    }));
  }

  function atualizarItem(id: string, campo: keyof ItemOrcamento, valor: string | number | boolean) {
    setOrcamento((prev) => ({
      ...prev,
      itens: prev.itens.map((item) => {
        if (item.id !== id) return item;
        const atualizado = { ...item, [campo]: valor };

        if (campo === "valorUnitario") {
          atualizado.valorAjustado = true;
          atualizado.total = Number(valor) * (atualizado.quantidade || 0);
          return atualizado;
        }

        return recalcularItem(atualizado);
      }),
    }));
  }

  function resetarValorItem(id: string) {
    setOrcamento((prev) => ({
      ...prev,
      itens: prev.itens.map((item) =>
        item.id !== id ? item : recalcularItem({ ...item, valorAjustado: false })
      ),
    }));
  }

  function adicionarItem() {
    setOrcamento((prev) => ({ ...prev, itens: [...prev.itens, itemVazio(prev.margemPadrao)] }));
  }

  function removerItem(id: string) {
    setOrcamento((prev) => ({ ...prev, itens: prev.itens.filter((i) => i.id !== id) }));
  }

  const totalGeral = orcamento.itens.reduce((acc, i) => acc + (i.total || 0), 0);

  async function salvar() {
    setSalvando(true);
    try {
      const res = await fetch("/api/orcamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...orcamento, id: gerarId(), createdAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error();
      const salvo = await res.json();
      router.push(`/orcamentos/${salvo.id}`);
    } catch {
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Revisar Orçamento</h1>
            <p className="text-gray-500 text-sm">Verifique os dados, preencha os custos e ajuste a margem.</p>
          </div>
          <button onClick={salvar} disabled={salvando}
            className="bg-[#fb4d06] text-white font-semibold py-2 px-6 rounded-xl hover:opacity-90 transition disabled:opacity-50">
            {salvando ? "Salvando..." : "Salvar Orçamento →"}
          </button>
        </div>

        {/* Informações gerais */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Informações Gerais</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nº Orçamento</label>
              <div className="border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm font-bold text-[#fb4d06]">
                {orcamento.numero || "Gerando..."}
              </div>
            </div>
            <ComboboxCliente
              value={orcamento.cliente}
              onChange={(v) => atualizarCampo("cliente", v)}
              onSelect={selecionarCliente}
            />
            <Campo label="Solicitante" value={orcamento.solicitante} onChange={(v) => atualizarCampo("solicitante", v)} />
            <Campo label="Data do Orçamento" value={orcamento.dataOrcamento} onChange={(v) => atualizarCampo("dataOrcamento", v)} />
            <Campo label="Prazo de Pagamento" value={orcamento.prazoPagamento} onChange={(v) => atualizarCampo("prazoPagamento", v)} />
            <Campo label="Prazo de Entrega" value={orcamento.prazoEntrega} onChange={(v) => atualizarCampo("prazoEntrega", v)} />
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-red-600 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                value={orcamento.observacoes} onChange={(e) => atualizarCampo("observacoes", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Frete</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                value={orcamento.frete} onChange={(e) => atualizarCampo("frete", e.target.value)} />
            </div>
          </div>
        </div>

        {/* Margem padrão */}
        <div className="bg-[#fb4d06]/5 border border-[#fb4d06]/20 rounded-2xl p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-[#fb4d06] mb-0.5">Margem Padrão do Orçamento</h2>
            <p className="text-xs text-[#fb4d06]">Aplica a todos os itens. Pode ajustar item a item depois.</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0} max={99}
              className="w-24 border border-[#fb4d06]/30 rounded-lg px-3 py-2 text-sm font-bold text-[#fb4d06] bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/40 text-center"
              value={orcamento.margemPadrao}
              onChange={(e) => aplicarMargemPadraoATodos(Number(e.target.value))}
            />
            <span className="text-[#fb4d06] font-bold">%</span>
            <span className="text-xs text-[#fb4d06]/80 ml-1">
              Markup equivalente: {orcamento.margemPadrao < 100 ? (100 / (1 - orcamento.margemPadrao / 100) - 100).toFixed(1) : "∞"}%
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
                  {/* Cabeçalho do item */}
                  <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between gap-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[#fb4d06] uppercase">Item {idx + 1}</span>
                      <SeletorProduto
                        produtos={produtos}
                        onSelect={(p) => selecionarProduto(item.id, p)}
                      />
                    </div>
                    {orcamento.itens.length > 1 && (
                      <button onClick={() => removerItem(item.id)} className="text-red-400 hover:text-red-600 text-xs">Remover</button>
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
                        <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                          value={item.acabamento} onChange={(e) => atualizarItem(item.id, "acabamento", e.target.value)}>
                          {TIPOS.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <CampoNumero label="Quantidade" value={item.quantidade} onChange={(v) => atualizarItem(item.id, "quantidade", v)} />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Descrição Técnica</label>
                      <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none min-h-[70px] focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                        value={item.descricao} onChange={(e) => atualizarItem(item.id, "descricao", e.target.value)} />
                    </div>

                    {/* Precificação */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Precificação</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <CampoNumero label="Custo unit. fornecedor (R$)" value={item.custoUnitario} onChange={(v) => atualizarItem(item.id, "custoUnitario", v)} />
                        <CampoNumero label="Frete de produção total (R$)" value={item.freteProducao} onChange={(v) => atualizarItem(item.id, "freteProducao", v)} />
                        <CampoNumero label="Custo de arte (R$)" value={item.custoArte} onChange={(v) => atualizarItem(item.id, "custoArte", v)} />
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Margem (%)</label>
                          <input type="number" min={0} max={99}
                            className="w-full border border-[#fb4d06]/20 rounded-lg px-3 py-2 text-sm text-[#fb4d06] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/40"
                            value={item.margem || ""}
                            onChange={(e) => atualizarItem(item.id, "margem", Number(e.target.value))} />
                        </div>
                      </div>

                      {/* Resumo de custos e preço final */}
                      <div className="flex flex-wrap items-end gap-4 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-500">
                          Custo total unit.: <span className="font-semibold text-gray-700">R$ {custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                        {valorSugerido > 0 && (
                          <div className="text-xs text-gray-500">
                            Preço sugerido: <span className="font-semibold text-green-700">R$ {valorSugerido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}

                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2 mb-1">
                            <label className="text-xs font-medium text-gray-600">Preço final ao cliente (R$)</label>
                            {item.valorAjustado && (
                              <button onClick={() => resetarValorItem(item.id)}
                                className="text-xs text-blue-500 hover:text-blue-700 underline">
                                Usar calculado
                              </button>
                            )}
                          </div>
                          <input type="number"
                            className={`w-full border-2 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/40 ${item.valorAjustado ? "border-orange-300 text-orange-700" : "border-[#fb4d06]/30 text-[#fb4d06]"}`}
                            value={item.valorUnitario || ""}
                            onChange={(e) => atualizarItem(item.id, "valorUnitario", Number(e.target.value))}
                            placeholder={valorSugerido > 0 ? valorSugerido.toFixed(2) : "0,00"}
                          />
                          {item.valorAjustado && item.valorUnitario > 0 && custoTotal > 0 && (
                            <p className="text-xs mt-1 text-orange-600">
                              Margem real: {margemReal.toFixed(1)}% {margemReal < item.margem ? "↓ abaixo do padrão" : "↑ acima do padrão"}
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

          <button onClick={adicionarItem}
            className="mt-4 w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-[#fb4d06]/30 hover:text-[#fb4d06] transition">
            + Adicionar item
          </button>
        </div>

        {/* Total geral */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex justify-between items-center">
          <span className="font-semibold text-gray-700">Total Geral</span>
          <span className="text-2xl font-bold text-[#fb4d06]">
            R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={salvar} disabled={salvando}
            className="bg-[#fb4d06] text-white font-semibold py-3 px-10 rounded-xl hover:opacity-90 transition disabled:opacity-50">
            {salvando ? "Salvando..." : "Salvar e Ver Orçamento →"}
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
      <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
        value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function CampoNumero({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input type="number"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
        value={value || ""} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
