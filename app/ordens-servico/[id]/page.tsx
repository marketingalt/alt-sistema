"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import { STATUS_OS_CONFIG, type OrdemServico, type StatusOS, type Tarefa } from "@/app/types";

function Icone({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
    </svg>
  );
}

const STATUS_OS_LIST: StatusOS[] = ["Pendente", "Em produção", "Pronto", "Entregue", "Cancelada"];

export default function DetalheOSPage() {
  const params = useParams();
  const router = useRouter();
  const osId = params?.id as string;

  const [os, setOs] = useState<OrdemServico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [subtarefas, setSubtarefas] = useState<Tarefa[]>([]);
  const [projetosMap, setProjetosMap] = useState<Record<string, { nome: string; cor: string }>>({});
  const [salvandoStatus, setSalvandoStatus] = useState(false);

  async function carregar() {
    try {
      const res = await fetch(`/api/ordens-servico/${osId}`);
      if (!res.ok) throw new Error("Não encontrada");
      const data: OrdemServico = await res.json();
      setOs(data);

      // Buscar subtarefas vinculadas
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

      // Buscar projetos para mapear status do kanban
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
    } catch {
      setErro("OS não encontrada");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, [osId]);

  async function alterarStatus(novoStatus: StatusOS) {
    setSalvandoStatus(true);
    try {
      const res = await fetch(`/api/ordens-servico/${osId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (res.ok) {
        const atualizada = await res.json();
        setOs(atualizada);
      }
    } catch {}
    finally { setSalvandoStatus(false); }
  }

  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // Encontrar nome do status do kanban para uma tarefa
  function statusKanbanTarefa(tarefa: Tarefa): string {
    // Como não temos o projeto completo aqui, extraímos do statusId
    // Simplificação: exibe o projectId para referência
    return tarefa.statusId;
  }

  if (carregando) {
    return (
      <WorkspaceLayout>
        <main className="px-8 py-8 max-w-7xl mx-auto">
          <p className="text-gray-500 text-sm">Carregando...</p>
        </main>
      </WorkspaceLayout>
    );
  }

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

  const totalCustos = os.itens.reduce((acc, i) => acc + i.totalCusto, 0);

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/ordens-servico" className="hover:text-[#fb4d06] transition">Ordens de Serviço</Link>
          <span>/</span>
          <span className="text-gray-800 font-semibold">OS #{os.numero}</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-800">OS #{os.numero}</h1>
                <Link
                  href={`/orcamentos/${os.orcamentoId}`}
                  className="text-sm font-medium text-[#fb4d06] hover:underline"
                >
                  Orçamento #{os.orcamentoNumero}
                </Link>
              </div>
              <p className="text-gray-500 text-sm">{os.cliente} · {os.solicitante}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Seletor de status da OS */}
              <div className="flex items-center gap-1">
                {STATUS_OS_LIST.map((s) => (
                  <button
                    key={s}
                    onClick={() => alterarStatus(s)}
                    disabled={salvandoStatus || s === os.status}
                    className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition ${
                      s === os.status
                        ? `${STATUS_OS_CONFIG[s].bg} ${STATUS_OS_CONFIG[s].cor} border-current cursor-default`
                        : "bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t border-gray-100">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Responsável</p>
              <p className="text-sm text-gray-800">{os.responsavel || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Data do Orçamento</p>
              <p className="text-sm text-gray-800">{new Date(os.dataOrcamento).toLocaleDateString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Prazo de Pagamento</p>
              <p className="text-sm text-gray-800">{os.prazoPagamento || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Prazo de Entrega</p>
              <p className="text-sm text-gray-800">{os.prazoEntrega || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Criada em</p>
              <p className="text-sm text-gray-800">{new Date(os.createdAt).toLocaleDateString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo</p>
              <p className="text-sm text-gray-800">{os.criadoAutomaticamente ? "Automática" : "Manual"}</p>
            </div>
          </div>
        </div>

        {/* Observações */}
        {os.observacoes && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Observações</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{os.observacoes}</p>
          </div>
        )}

        {/* Itens da OS */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-800">Itens da Ordem de Serviço</h2>
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

        {/* Subtarefas Vinculadas */}
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
                    <div key={st.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-3 min-w-0">
                        {projetoInfo && (
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: projetoInfo.cor }} />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{st.titulo}</p>
                          <p className="text-xs text-gray-500">
                            {projetoInfo?.nome || "Projeto"}
                            {st.dataVencimento && ` · ${new Date(st.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR")}`}
                          </p>
                        </div>
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded whitespace-nowrap"
                        style={{
                          backgroundColor: "#e5e7eb",
                          color: "#374151",
                        }}
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
