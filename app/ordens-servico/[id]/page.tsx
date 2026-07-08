"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import type {
  OrdemServico,
  StatusOS,
  CampoDinamicoDef,
  Tarefa,
  Cliente,
} from "@/app/types";
import type { SystemSettings } from "@/lib/admin";
import StatusRoadmap from "./components/StatusRoadmap";
import CabecalhoOS from "./components/CabecalhoOS";
import DetalhamentoOS from "./components/DetalhamentoOS";
import AreaInternaOS from "./components/AreaInternaOS";

function Icone({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
    </svg>
  );
}

export default function DetalheOSPage() {
  const params = useParams();
  const router = useRouter();
  const osId = params?.id as string;

  const [os, setOs] = useState<OrdemServico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Dados auxiliares
  const [camposDinamicos, setCamposDinamicos] = useState<CampoDinamicoDef[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [subtarefas, setSubtarefas] = useState<Tarefa[]>([]);
  const [projetosMap, setProjetosMap] = useState<Record<string, { nome: string; cor: string }>>({});

  // Status de outros módulos para o roadmap
  const [orcamentoStatus, setOrcamentoStatus] = useState<string | undefined>();
  const [financeiroColuna, setFinanceiroColuna] = useState<string | undefined>();
  const [planejamentoColuna, setPlanejamentoColuna] = useState<string | undefined>();

  // ── Carregar dados ─────────────────────────────────
  async function carregar() {
    try {
      const res = await fetch(`/api/ordens-servico/${osId}`);
      if (!res.ok) throw new Error("Não encontrada");
      const data: OrdemServico = await res.json();
      setOs(data);

      // Campos dinâmicos das configurações
      try {
        const resC = await fetch("/api/admin/configuracoes");
        if (resC.ok) {
          const settings: SystemSettings = await resC.json();
          setCamposDinamicos(settings.osCamposDinamicos || []);
        }
      } catch {}

      // Dados do cliente do cadastro
      if (data.cliente) {
        try {
          const resCl = await fetch(`/api/clientes?search=${encodeURIComponent(data.cliente)}`);
          if (resCl.ok) {
            const clientes: Cliente[] = await resCl.json();
            if (clientes.length > 0) setCliente(clientes[0]);
          }
        } catch {}
      }

      // Orçamento original
      try {
        const resO = await fetch(`/api/orcamentos/${data.orcamentoId}`);
        if (resO.ok) {
          const orcamento = await resO.json();
          setOrcamentoStatus(orcamento.status || "—");
        }
      } catch {}

      // Subtarefas vinculadas
      try {
        const resT = await fetch("/api/planejamento/tarefas");
        if (resT.ok) {
          const todas: Tarefa[] = await resT.json();
          const vinculadas = todas.filter(
            (t) => t.parentTaskId && t.customFields?.osId === osId
          );
          setSubtarefas(vinculadas);
        }
      } catch {}

      // Projetos para mapear status
      try {
        const resP = await fetch("/api/planejamento");
        if (resP.ok) {
          const dataP = await resP.json();
          const map: Record<string, { nome: string; cor: string }> = {};
          for (const p of dataP.projetos || []) {
            map[p.id] = { nome: p.nome, cor: p.cor };
          }
          setProjetosMap(map);
        }
      } catch {}

      // Financeiro kanban — busca a coluna da tarefa financeira do orçamento
      try {
        const resF = await fetch("/api/financeiro/kanban");
        if (resF.ok) {
          const kanban = await resF.json();
          const tarefas = kanban.colunas?.flatMap((c: any) =>
            (c.tarefas || []).map((t: any) => ({ ...t, coluna: c.nome }))
          ) || [];
          const fin = tarefas.find(
            (t: any) => t.orcamentoId === data.orcamentoId || t.titulo?.includes(data.orcamentoNumero)
          );
          if (fin) setFinanceiroColuna(fin.coluna || "—");
        }
      } catch {}

      // Planejamento — busca tarefa do orçamento no kanban
      try {
        const resPl = await fetch("/api/planejamento/tarefas");
        if (resPl.ok) {
          const todas: Tarefa[] = await resPl.json();
          const tarefaOrcamento = todas.find(
            (t) => !t.parentTaskId && t.customFields?.orcamentoId === data.orcamentoId
          );
          if (tarefaOrcamento) {
            const projeto = projetosMap[tarefaOrcamento.projectId];
            if (projeto) {
              setPlanejamentoColuna(projeto.nome);
            }
          }
        }
      } catch {}
    } catch {
      setErro("OS não encontrada");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [osId]);

  // ── Salvar alterações na OS ────────────────────────
  const salvarOS = useCallback(
    async (updates: Partial<OrdemServico>) => {
      if (!os) return;
      setSalvando(true);
      try {
        const res = await fetch(`/api/ordens-servico/${osId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const atualizada = await res.json();
          setOs(atualizada);
        }
      } catch (err) {
        console.error("[SAVE OS ERROR]", err);
        alert("Erro ao salvar alterações.");
      } finally {
        setSalvando(false);
      }
    },
    [os, osId]
  );

  // ── Alterar status da OS ───────────────────────────
  async function alterarStatus(novoStatus: StatusOS) {
    await salvarOS({ status: novoStatus });
  }

  async function alterarStatusFornecedor(novo: string) {
    await salvarOS({ statusFornecedor: novo });
  }

  // ── Formatadores ───────────────────────────────────
  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  const totalCustos = os?.itens.reduce((acc, i) => acc + i.totalCusto, 0) || 0;

  // ── Loading ────────────────────────────────────────
  if (carregando) {
    return (
      <WorkspaceLayout>
        <main className="px-8 py-8 max-w-7xl mx-auto">
          <p className="text-gray-500 text-sm">Carregando...</p>
        </main>
      </WorkspaceLayout>
    );
  }

  // ── Error ──────────────────────────────────────────
  if (erro || !os) {
    return (
      <WorkspaceLayout>
        <main className="px-8 py-8 max-w-7xl mx-auto">
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
            <Icone d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-800 font-semibold mb-1">{erro || "Erro ao carregar OS"}</p>
            <button onClick={() => router.push("/ordens-servico")} className="text-sm font-semibold text-white bg-[#fb4d06] px-5 py-2.5 rounded-xl hover:opacity-90 transition mt-2">
              Voltar para OS
            </button>
          </div>
        </main>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/ordens-servico" className="hover:text-[#fb4d06] transition">
            Ordens de Serviço
          </Link>
          <span>/</span>
          <span className="text-gray-800 font-semibold">OS #{os.numero}</span>

          {salvando && (
            <span className="text-xs text-gray-400 ml-auto">Salvando...</span>
          )}
        </div>

        {/* ── STATUS ROADMAP ─────────────────────── */}
        <StatusRoadmap
          osStatus={os.status}
          orcamentoStatus={orcamentoStatus}
          financeiroColuna={financeiroColuna}
          planejamentoColuna={planejamentoColuna}
          fornecedorStatus={os.statusFornecedor}
          onStatusOSChange={alterarStatus}
          onFornecedorStatusChange={alterarStatusFornecedor}
        />

        {/* ── CABEÇALHO ──────────────────────────── */}
        <CabecalhoOS os={os} cliente={cliente} />

        {/* ── ITENS — TABELA DE CUSTOS ───────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-800">
              Itens da Ordem de Serviço
              <span className="text-gray-400 font-normal ml-1">({os.itens.length})</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kit</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ref.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Item</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Qtd</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fornecedor</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Custo Unit.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Frete</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Personaliz.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Embalagem</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Custo</th>
                </tr>
              </thead>
              <tbody>
                {os.itens.map((item) => (
                  <tr key={item.itemOrcamentoId} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 text-gray-700">{item.kit}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.referencia}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{item.item}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.quantidade}</td>
                    <td className="px-4 py-3 text-gray-700">{item.fornecedorNome || "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatarMoeda(item.custoUnitario)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatarMoeda(item.freteProducao)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatarMoeda(item.custoPersonalizacao)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatarMoeda((item.custoEmbalagemIndividual || 0) + (item.custoEmbalagemTransporte || 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatarMoeda(item.totalCusto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={9} className="px-4 py-3 text-right text-sm font-bold text-gray-800">Total Geral</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-800">{formatarMoeda(totalCustos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── DETALHAMENTO TÉCNICO ──────────────── */}
        <DetalhamentoOS
          os={os}
          camposDinamicos={camposDinamicos}
          onUpdateOS={salvarOS}
          osId={osId}
        />

        {/* ── ÁREA INTERNA ──────────────────────── */}
        <AreaInternaOS
          os={os}
          camposDinamicos={camposDinamicos}
          onUpdateOS={salvarOS}
        />

        {/* ── SUBTAREFAS VINCULADAS ─────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-800">
              Subtarefas Vinculadas
              {subtarefas.length > 0 && (
                <span className="text-gray-400 font-normal ml-1">({subtarefas.length})</span>
              )}
            </h2>
          </div>
          <div className="p-6">
            {subtarefas.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-8">
                Nenhuma subtarefa vinculada a esta OS.
                <br />
                Crie subtarefas no card do Planejamento para acompanhar a execução.
              </p>
            ) : (
              <div className="space-y-2">
                {subtarefas.map((st) => {
                  const projetoInfo = projetosMap[st.projectId];
                  return (
                    <div
                      key={st.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {projetoInfo && (
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: projetoInfo.cor }}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{st.titulo}</p>
                          <p className="text-xs text-gray-500">
                            {projetoInfo?.nome || "Projeto"}
                            {st.dataVencimento &&
                              ` · ${new Date(st.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR")}`}
                          </p>
                        </div>
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded whitespace-nowrap"
                        style={{ backgroundColor: "#e5e7eb", color: "#374151" }}
                      >
                        {st.statusId.substring(0, 8)}...
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </WorkspaceLayout>
  );
}
