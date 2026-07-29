"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import type {
  OrdemServico,
  StatusOS,
  CampoDinamicoDef,
  Tarefa,
  Cliente,
  DocumentoFornecedor,
  Fornecedor,
} from "@/app/types";
import type { SystemSettings } from "@/lib/admin";
import StatusRoadmap from "./components/StatusRoadmap";
import CabecalhoOS from "./components/CabecalhoOS";
import DetalhamentoOS from "./components/DetalhamentoOS";
import AreaInternaOS from "./components/AreaInternaOS";
import { downloadCSV } from "@/lib/export-csv";
import type { ResumoFluxoOS, ItemFluxoOS } from "@/app/api/ordens-servico/[id]/fluxo-caixa/route";

function Icone({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
    </svg>
  );
}

// ── Rótulos dos módulos do roadmap ─────────────────────
const ROTULOS_MODULOS: Record<string, string> = {
  orcamento: "Orçamento",
  financeiro: "Financeiro",
  fornecedor: "Fornecedor",
  os: "Ordem de Serviço",
  planejamento: "Planejamento",
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ═══════════════════════════════════════════════════════════
// MODAL DE DOCUMENTOS
// ═══════════════════════════════════════════════════════════

function ModalDocumentos({
  modulo,
  documentos,
  fechar,
  orcamentoId,
}: {
  modulo: string;
  documentos: DocumentoFornecedor[];
  fechar: () => void;
  orcamentoId: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={fechar} />

      {/* Painel */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[75vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <h2 className="text-lg font-bold text-gray-800">
              Documentos — {ROTULOS_MODULOS[modulo] || modulo}
            </h2>
          </div>
          <button
            onClick={fechar}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {documentos.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-400">Nenhum documento anexado a este orçamento.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documentos.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 hover:border-gray-200 transition"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Ícone do tipo */}
                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                      {doc.tipo?.includes("pdf") ? (
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      ) : doc.tipo?.includes("image") ? (
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.nome}</p>
                      <p className="text-[11px] text-gray-400">
                        {formatarTamanho(doc.tamanho)}
                        {doc.uploadedBy && ` · ${doc.uploadedBy}`}
                        {doc.uploadedAt && ` · ${new Date(doc.uploadedAt).toLocaleDateString("pt-BR")}`}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <a
                      href={`/api/orcamentos/${orcamentoId}/documentos/${doc.id}?inline=1`}
                      target="_blank"
                      className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
                      title="Visualizar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </a>
                    <a
                      href={`/api/orcamentos/${orcamentoId}/documentos/${doc.id}`}
                      download={doc.nome}
                      className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
                      title="Baixar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENTE DE DETALHES EXPANSÍVEIS
// ═══════════════════════════════════════════════════════════

function ItemDetalhes({ item }: { item: ItemFluxoOS }) {
  const d = item.detalhes as Record<string, any>;

  if (item.tipo === "conta-pagar") {
    return (
      <div className="bg-gray-50/80 px-6 py-4 border-t border-gray-100">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><span className="text-gray-400 block">Fornecedor</span><span className="font-medium text-gray-700">{String(d.fornecedor || "—")}</span></div>
          <div><span className="text-gray-400 block">Categoria</span><span className="font-medium text-gray-700">{String(d.categoria || "—")}</span></div>
          <div><span className="text-gray-400 block">Área</span><span className="font-medium text-gray-700">{String(d.area || "—")}</span></div>
          <div><span className="text-gray-400 block">Modalidade</span><span className="font-medium text-gray-700">{String(d.modalidade || "—")}</span></div>
          <div><span className="text-gray-400 block">Banco</span><span className="font-medium text-gray-700">{String(d.banco || "—")}</span></div>
          {d.dataPagamento && <div><span className="text-gray-400 block">Data Pagamento</span><span className="font-medium text-gray-700">{String(d.dataPagamento)}</span></div>}
          {d.obs && <div className="col-span-2"><span className="text-gray-400 block">Obs</span><span className="font-medium text-gray-700">{String(d.obs)}</span></div>}
          {d.dadosBancarios && (
            <div className="col-span-2">
              <span className="text-gray-400 block">Dados Bancários</span>
              <span className="font-medium text-gray-700">{d.dadosBancarios?.banco || ""} {d.dadosBancarios?.chavePix || ""}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (item.tipo === "reembolso") {
    return (
      <div className="bg-gray-50/80 px-6 py-4 border-t border-gray-100">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><span className="text-gray-400 block">Motorista</span><span className="font-medium text-gray-700">{String(d.motorista || "—")}</span></div>
          <div><span className="text-gray-400 block">Origem</span><span className="font-medium text-gray-700">{String(d.origem || "—")}</span></div>
          <div><span className="text-gray-400 block">Destino</span><span className="font-medium text-gray-700">{String(d.destino || "—")}</span></div>
          <div><span className="text-gray-400 block">Distância</span><span className="font-medium text-gray-700">{String(d.distanciaKm || "0")} km</span></div>
          <div><span className="text-gray-400 block">Valor/km</span><span className="font-medium text-gray-700">{Number(d.valorKm || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
          <div><span className="text-gray-400 block">Total</span><span className="font-medium text-gray-700">{Number(d.total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
          {d.motivo && <div><span className="text-gray-400 block">Motivo</span><span className="font-medium text-gray-700">{String(d.motivo)}</span></div>}
          {d.observacao && <div className="col-span-2"><span className="text-gray-400 block">Observação</span><span className="font-medium text-gray-700">{String(d.observacao)}</span></div>}
          <div><span className="text-gray-400 block">Odômetro</span><span className="font-medium text-gray-700">{String(d.odometroInicial || "0")} → {String(d.odometroFinal || "0")} km</span></div>
        </div>
      </div>
    );
  }

  if (item.tipo === "faturamento") {
    return (
      <div className="bg-gray-50/80 px-6 py-4 border-t border-gray-100">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><span className="text-gray-400 block">Cliente</span><span className="font-medium text-gray-700">{String(d.cliente || "—")}</span></div>
          <div><span className="text-gray-400 block">Status Nota</span><span className={`font-medium ${d.statusNota === "Emitida" ? "text-green-600" : "text-yellow-600"}`}>{String(d.statusNota || "—")}</span></div>
          {d.numeroNota && <div><span className="text-gray-400 block">Nº Nota</span><span className="font-medium text-gray-700">{String(d.numeroNota)}</span></div>}
          {d.dataEmissao && <div><span className="text-gray-400 block">Emissão</span><span className="font-medium text-gray-700">{String(d.dataEmissao)}</span></div>}
          {d.vencimento && <div><span className="text-gray-400 block">Vencimento</span><span className="font-medium text-gray-700">{String(d.vencimento)}</span></div>}
          {d.dataPagamento && <div><span className="text-gray-400 block">Data Pagamento</span><span className="font-medium text-gray-700">{String(d.dataPagamento)}</span></div>}
          {d.imposto !== undefined && <div><span className="text-gray-400 block">Imposto</span><span className="font-medium text-gray-700">{Number(d.imposto || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>}
          {d.comissao !== undefined && <div><span className="text-gray-400 block">Comissão</span><span className="font-medium text-gray-700">{Number(d.comissao || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>}
        </div>
      </div>
    );
  }

  // fluxo-caixa genérico
  return (
    <div className="bg-gray-50/80 px-6 py-4 border-t border-gray-100">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div><span className="text-gray-400 block">Modalidade</span><span className="font-medium text-gray-700">{String(d.modalidade || "—")}</span></div>
        <div><span className="text-gray-400 block">Banco</span><span className="font-medium text-gray-700">{String(d.banco || "—")}</span></div>
        <div><span className="text-gray-400 block">Área</span><span className="font-medium text-gray-700">{String(d.area || "—")}</span></div>
        <div><span className="text-gray-400 block">Categoria</span><span className="font-medium text-gray-700">{String(d.categoria || "—")}</span></div>
        {d.obs && <div className="col-span-2"><span className="text-gray-400 block">Observação</span><span className="font-medium text-gray-700">{String(d.obs)}</span></div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════

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

  // Fluxo de caixa da OS
  const [fluxoCaixa, setFluxoCaixa] = useState<ResumoFluxoOS | null>(null);
  const [carregandoFluxo, setCarregandoFluxo] = useState(false);
  const [itemExpandido, setItemExpandido] = useState<string | null>(null);

  // Status de outros módulos para o roadmap
  const [orcamentoStatus, setOrcamentoStatus] = useState<string | undefined>();
  const [financeiroColuna, setFinanceiroColuna] = useState<string | undefined>();
  const [planejamentoColuna, setPlanejamentoColuna] = useState<string | undefined>();

  // Modal de documentos
  const [modalModulo, setModalModulo] = useState<string | null>(null);
  const [documentosOrcamento, setDocumentosOrcamento] = useState<DocumentoFornecedor[]>([]);
  const [carregandoDocs, setCarregandoDocs] = useState(false);

  // Fornecedores para exibir info de pagamento
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornecedorInfo, setFornecedorInfo] = useState<{ fornecedorNome: string; condicoesPagamento: string; dadosBancarios: string } | null>(null);

  // Referência para o id do orçamento (usado no polling e no modal)
  const orcamentoIdRef = useRef<string>("");

  // ── Função que carrega APENAS status (usada no polling) ─
  const carregarStatus = useCallback(async (orcamentoId: string) => {
    // Orçamento
    try {
      const resO = await fetch(`/api/orcamentos/${orcamentoId}`);
      if (resO.ok) {
        const orcamento = await resO.json();
        setOrcamentoStatus(orcamento.status || "—");
      }
    } catch {}

    // Financeiro kanban
    try {
      const resF = await fetch("/api/financeiro/kanban");
      if (resF.ok) {
        const kanban = await resF.json();
        const tarefas = kanban.colunas?.flatMap((c: any) =>
          (c.tarefas || []).map((t: any) => ({ ...t, coluna: c.nome }))
        ) || [];
        const fin = tarefas.find(
          (t: any) => t.orcamentoId === orcamentoId
        );
        if (fin) setFinanceiroColuna(fin.coluna || "—");
      }
    } catch {}

    // Planejamento
    try {
      const resPl = await fetch("/api/planejamento/tarefas");
      if (resPl.ok) {
        const todas: Tarefa[] = await resPl.json();
        const tarefaOrcamento = todas.find(
          (t) => !t.parentTaskId && t.customFields?.orcamentoId === orcamentoId
        );
        if (tarefaOrcamento) {
          try {
            const resP = await fetch("/api/planejamento");
            if (resP.ok) {
              const dataP = await resP.json();
              const proj = (dataP.projetos || []).find(
                (p: any) => p.id === tarefaOrcamento.projectId
              );
              if (proj) setPlanejamentoColuna(proj.nome);
            }
          } catch {}
        }
      }
    } catch {}
  }, []);

  // ── Carregar dados completos (primeira carga) ──────────
  async function carregar() {
    try {
      const res = await fetch(`/api/ordens-servico/${osId}`);
      if (!res.ok) throw new Error("Não encontrada");
      const data: OrdemServico = await res.json();
      setOs(data);
      orcamentoIdRef.current = data.orcamentoId;

      // Anexos da OS (Supabase Storage/Postgres)
      try {
        const resDocs = await fetch(`/api/ordens-servico/${osId}/documentos`);
        if (resDocs.ok) {
          const docs = await resDocs.json();
          setOs((prev) => (prev ? { ...prev, documentos: docs } : prev));
        }
      } catch {}

      // Campos dinâmicos
      try {
        const resC = await fetch("/api/admin/configuracoes");
        if (resC.ok) {
          const settings: SystemSettings = await resC.json();
          setCamposDinamicos(settings.osCamposDinamicos || []);
        }
      } catch {}

      // Cliente
      if (data.cliente) {
        try {
          const resCl = await fetch(`/api/clientes?search=${encodeURIComponent(data.cliente)}`);
          if (resCl.ok) {
            const clientes: Cliente[] = await resCl.json();
            if (clientes.length > 0) setCliente(clientes[0]);
          }
        } catch {}
      }

      // Fornecedores (para exibir info de pagamento)
      try {
        const resForn = await fetch("/api/fornecedores");
        if (resForn.ok) setFornecedores(await resForn.json());
      } catch {}

      // Subtarefas
      try {
        const resT = await fetch("/api/planejamento/tarefas");
        if (resT.ok) {
          const todas: Tarefa[] = await resT.json();
          setSubtarefas(todas.filter((t) => t.parentTaskId && t.customFields?.osId === osId));
        }
      } catch {}

      // Projetos
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

      // Status — carrega junto na primeira vez
      await carregarStatus(data.orcamentoId);

      // Fluxo de caixa da OS
      carregarFluxoCaixa();
    } catch {
      setErro("OS não encontrada");
    } finally {
      setCarregando(false);
    }
  }

  // ── Carregar fluxo de caixa agregado ─────────────────
  async function carregarFluxoCaixa() {
    setCarregandoFluxo(true);
    try {
      const res = await fetch(`/api/ordens-servico/${osId}/fluxo-caixa`);
      if (res.ok) {
        const data: ResumoFluxoOS = await res.json();
        setFluxoCaixa(data);
      }
    } catch {
      // silencioso
    } finally {
      setCarregandoFluxo(false);
    }
  }

  // ── Carga inicial ─────────────────────────────────────
  useEffect(() => {
    carregar();
  }, [osId]);

  // ── POLLING: atualiza status a cada 30s ──────────────
  useEffect(() => {
    if (!orcamentoIdRef.current) return;
    const interval = setInterval(() => {
      if (orcamentoIdRef.current) {
        carregarStatus(orcamentoIdRef.current);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [carregarStatus]);

  // ── POLLING: atualiza ao voltar para a aba ──────────
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible" && orcamentoIdRef.current) {
        carregarStatus(orcamentoIdRef.current);
        carregarFluxoCaixa();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [carregarStatus]);

  // ── Abrir modal de documentos de uma área ────────────
  async function abrirDocumentos(modulo: string) {
    setModalModulo(modulo);
    setCarregandoDocs(true);
    try {
      const res = await fetch(`/api/orcamentos/${orcamentoIdRef.current}/documentos`);
      setDocumentosOrcamento(res.ok ? await res.json() : []);
    } catch {
      setDocumentosOrcamento([]);
    } finally {
      setCarregandoDocs(false);
    }
  }

  function fecharModal() {
    setModalModulo(null);
    setDocumentosOrcamento([]);
  }

  // ── Salvar alterações na OS ──────────────────────────
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
          // Após salvar, atualiza status no roadmap
          carregarStatus(orcamentoIdRef.current);
        }
      } catch (err) {
        console.error("[SAVE OS ERROR]", err);
      } finally {
        setSalvando(false);
      }
    },
    [os, osId, carregarStatus]
  );

  async function alterarStatus(novoStatus: StatusOS) {
    await salvarOS({ status: novoStatus });
  }

  async function alterarStatusFornecedor(novo: string) {
    await salvarOS({ statusFornecedor: novo });
  }

  const totalCustos = os?.itens.reduce((acc, i) => acc + i.totalCusto, 0) || 0;

  // ── Loading ──────────────────────────────────────────
  if (carregando) {
    return (
      <WorkspaceLayout>
        <main className="px-8 py-8 max-w-7xl mx-auto">
          <p className="text-gray-500 text-sm">Carregando...</p>
        </main>
      </WorkspaceLayout>
    );
  }

  // ── Error ────────────────────────────────────────────
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
            <span className="text-xs text-gray-400 ml-auto animate-pulse">Salvando...</span>
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
          onModuleClick={abrirDocumentos}
        />

        {/* ── Audit trail ──────────────────────── */}
        {(os.userName || os.updatedBy) && (
          <p className="text-xs text-gray-400 mb-4">
            👤 Criado por {os.userName || "—"} · {os.createdAt ? new Date(os.createdAt).toLocaleDateString("pt-BR") : "—"}
            {os.updatedBy && <> · ✏️ Última alteração por {os.updatedBy} · {os.updatedAt ? new Date(os.updatedAt).toLocaleString("pt-BR") : "—"}</>}
          </p>
        )}

        {/* ── CABEÇALHO ──────────────────────────── */}
        <CabecalhoOS os={os} cliente={cliente} onUpdateOS={salvarOS} />

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
                    <td className="px-4 py-3 text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <span>{item.fornecedorNome || "—"}</span>
                          {item.fornecedorId && fornecedores.find((f) => f.id === item.fornecedorId) && (
                            <button
                              onClick={() => {
                                const f = fornecedores.find((x) => x.id === item.fornecedorId);
                                if (f) setFornecedorInfo({
                                  fornecedorNome: f.nomeFantasia || f.razaoSocial,
                                  condicoesPagamento: f.condicoesPagamento || "Não informado",
                                  dadosBancarios: f.dadosBancarios || "Não informado",
                                });
                              }}
                              className="text-gray-400 hover:text-[#fb4d06] transition shrink-0"
                              title="Ver condições de pagamento"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
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
        {/* ^^ fim Subtarefas ^^ */}

        {/* ── FLUXO DE CAIXA / CUSTOS DA OS ─────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Fluxo de Caixa / Custos
              {fluxoCaixa && <span className="text-gray-400 font-normal ml-1">({fluxoCaixa.itens.length})</span>}
            </h2>
            {fluxoCaixa && fluxoCaixa.itens.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const headers = ["Data", "Tipo", "Descrição", "Valor", "Status"];
                    const rows = fluxoCaixa.itens.map((i) => [
                      i.data ? new Date(i.data + (i.data.includes("T") ? "" : "T12:00:00")).toLocaleDateString("pt-BR") : "",
                      i.tipo,
                      i.descricao,
                      `R$ ${Math.abs(i.valor).toFixed(2)} ${i.valor < 0 ? "(D)" : "(R)"}`,
                      i.status,
                    ]);
                    downloadCSV(`fluxo-caixa-os-${os.numero}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
                  }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Exportar CSV
                </button>
              </div>
            )}
          </div>

          {carregandoFluxo ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-[#fb4d06] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Carregando custos...</p>
            </div>
          ) : !fluxoCaixa || fluxoCaixa.itens.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
              <p className="text-sm text-gray-400">Nenhum lançamento financeiro vinculado a esta OS.</p>
              <p className="text-xs text-gray-300 mt-1">Custos aparecerão automaticamente ao vincular contas a pagar, reembolsos ou faturamentos.</p>
            </div>
          ) : (
            <>
              {/* ── CARDS DE RESUMO ──────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-4 bg-gray-50/50 border-b border-gray-100">
                <div className="bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-green-600">Receitas</p>
                  <p className="text-lg font-bold text-green-700 mt-0.5">{formatarMoeda(fluxoCaixa.receitas)}</p>
                </div>
                <div className="bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600">Despesas</p>
                  <p className="text-lg font-bold text-red-700 mt-0.5">{formatarMoeda(fluxoCaixa.despesas)}</p>
                </div>
                <div className="bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Saldo</p>
                  <p className={`text-lg font-bold mt-0.5 ${fluxoCaixa.saldo >= 0 ? "text-blue-700" : "text-red-700"}`}>
                    {formatarMoeda(fluxoCaixa.saldo)}
                  </p>
                </div>
                <div className="bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Contas / Reemb.</p>
                  <p className="text-sm font-bold text-gray-700 mt-0.5">
                    {formatarMoeda(fluxoCaixa.contasPagar)} / {formatarMoeda(fluxoCaixa.reembolsos)}
                  </p>
                </div>
              </div>

              {/* ── TABELA DE ITENS ──────────────────── */}
              <div className="divide-y divide-gray-50">
                {fluxoCaixa.itens.map((item) => (
                  <div key={`${item.tipo}-${item.id}`} className="transition">
                    {/* Linha principal */}
                    <button
                      onClick={() => setItemExpandido(itemExpandido === `${item.tipo}-${item.id}` ? null : `${item.tipo}-${item.id}`)}
                      className="w-full flex items-center gap-3 px-6 py-3 hover:bg-gray-50/80 transition text-left"
                    >
                      {/* Tipo */}
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${
                        item.tipo === "faturamento"
                          ? "bg-green-100 text-green-700"
                          : item.tipo === "conta-pagar"
                          ? "bg-orange-100 text-orange-700"
                          : item.tipo === "reembolso"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {item.tipo === "conta-pagar" ? "C. Pagar" : item.tipo === "reembolso" ? "Reemb." : item.tipo}
                      </span>

                      {/* Data */}
                      <span className="text-xs text-gray-500 font-mono w-20 shrink-0">
                        {item.data ? new Date(item.data + (item.data.includes("T") ? "" : "T12:00:00")).toLocaleDateString("pt-BR") : "—"}
                      </span>

                      {/* Descrição */}
                      <span className="text-sm text-gray-800 truncate flex-1 min-w-0">{item.descricao}</span>

                      {/* Status */}
                      <span className={`text-[10px] font-semibold uppercase w-16 text-center shrink-0 ${
                        item.status === "pago" ? "text-green-600" :
                        item.status === "pendente" ? "text-yellow-600" :
                        item.status === "Cancelada" ? "text-red-500" :
                        "text-gray-500"
                      }`}>
                        {item.status === "realizado" ? "OK" : item.status}
                      </span>

                      {/* Valor */}
                      <span className={`text-sm font-semibold w-28 text-right shrink-0 ${
                        item.valor >= 0 ? "text-green-700" : "text-red-700"
                      }`}>
                        {formatarMoeda(item.valor)}
                      </span>

                      {/* Seta expandir */}
                      <svg className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${itemExpandido === `${item.tipo}-${item.id}` ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Conteúdo expandido */}
                    {itemExpandido === `${item.tipo}-${item.id}` && (
                      <ItemDetalhes item={item} />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ── MODAL INFO FORNECEDOR ──────────────── */}
      {fornecedorInfo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setFornecedorInfo(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 p-6" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setFornecedorInfo(null)} className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-base font-bold text-gray-800 mb-4">{fornecedorInfo.fornecedorNome}</h3>

            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Condições de Pagamento</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{fornecedorInfo.condicoesPagamento}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Dados Bancários</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{fornecedorInfo.dadosBancarios}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE DOCUMENTOS ───────────────────── */}
      {modalModulo && (
        carregandoDocs ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-2xl p-8 shadow-2xl">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-[#fb4d06] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Carregando documentos...</p>
            </div>
          </div>
        ) : (
          <ModalDocumentos
            modulo={modalModulo}
            documentos={documentosOrcamento}
            fechar={fecharModal}
            orcamentoId={orcamentoIdRef.current}
          />
        )
      )}
    </WorkspaceLayout>
  );
}
