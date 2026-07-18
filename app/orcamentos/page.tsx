"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import type { Orcamento, StatusOrcamento } from "@/app/types";
import { STATUS_CONFIG } from "@/app/types";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import AvatarIniciais from "@/app/components/AvatarIniciais";
import ParticipantesAvatar from "@/app/components/ParticipantesAvatar";

const TODOS_STATUS = Object.keys(STATUS_CONFIG) as StatusOrcamento[];

function totalOrcamento(o: Orcamento) {
  const itens = o.itens.reduce((a, i) => a + (i.total || 0), 0);
  const servicos = o.manuseio && o.custoManuseio ? o.custoManuseio : 0;
  const frete = o.freteValor ?? 0;
  return itens + servicos + frete;
}

function custoTotalOrcamento(o: Orcamento) {
  return o.itens.reduce((a, i) => {
    const qty = i.quantidade || 1;
    return a + (i.custoUnitario || 0) * qty + (i.freteProducao || 0) + (i.custoPersonalizacao || 0);
  }, 0);
}

function margemOrcamento(o: Orcamento): number | null {
  const receita = totalOrcamento(o);
  const custo = custoTotalOrcamento(o);
  if (!receita || !custo) return null;
  return ((receita - custo) / receita) * 100;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StatusBadge({ status }: { status: StatusOrcamento }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.cor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  );
}

function StatusDropdown({ orcamentoId, statusAtual, onChange }: {
  orcamentoId: string;
  statusAtual: StatusOrcamento;
  onChange: (novo: StatusOrcamento) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  async function mudar(novo: StatusOrcamento) {
    setAberto(false);
    await fetch(`/api/orcamentos/${orcamentoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novo }),
    });
    onChange(novo);
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.preventDefault()}>
      <button
        onClick={(e) => { e.preventDefault(); setAberto((p) => !p); }}
        className="flex items-center gap-1"
      >
        <StatusBadge status={statusAtual} />
        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {aberto && (
        <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
          {TODOS_STATUS.map((s) => (
            <button
              key={s}
              onClick={() => mudar(s)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${s === statusAtual ? "font-bold" : ""}`}
            >
              <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s].dot}`} />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DownloadDropdown({ orcamentoId }: { orcamentoId: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAberto((p) => !p); }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
        title="Baixar PDF"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </button>

      {aberto && (
        <div className="absolute z-20 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[170px]" onClick={(e) => e.stopPropagation()}>
          <a
            href={`/api/pdf/${orcamentoId}?tipo=valores`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAberto(false)}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition"
          >
            <svg className="w-3.5 h-3.5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF Valores
          </a>
          <a
            href={`/api/pdf/${orcamentoId}?tipo=especificacoes`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAberto(false)}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition"
          >
            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF Especificações
          </a>
        </div>
      )}
    </div>
  );
}

export default function ListaOrcamentos() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [projetosPlanejamento, setProjetosPlanejamento] = useState<Record<string, { nome: string; cor: string }>>({});
  const { user } = useUser();
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string; email?: string }[]>([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");

  function carregarOrcamentos() {
    setCarregando(true);
    setErro(null);
    fetch("/api/orcamentos", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Erro HTTP " + r.status);
        return r.json();
      })
      .then((data) => {
        setOrcamentos(data.map((o: Orcamento) => ({ ...o, status: o.status || "Em andamento" })));
        setCarregando(false);
      })
      .catch((err) => {
        console.error("Erro ao carregar orçamentos:", err);
        setErro("Não foi possível carregar a lista de orçamentos.");
        setCarregando(false);
      });
  }

  function recarregarSeVisivel() {
    if (document.visibilityState === "visible") carregarOrcamentos();
  }

  useEffect(() => {
    carregarOrcamentos();

    // Carrega projetos do planejamento para exibir como tags
    fetch("/api/planejamento").then((r) => r.json()).then((data) => {
      if (data?.projetos) {
        const map: Record<string, { nome: string; cor: string }> = {};
        data.projetos.forEach((p: any) => { map[p.id] = { nome: p.nome, cor: p.cor || "#6366f1" }; });
        setProjetosPlanejamento(map);
      }
    }).catch(() => {});

    window.addEventListener("focus", carregarOrcamentos);
    document.addEventListener("visibilitychange", recarregarSeVisivel);

    // BFCache: quando o usuário volta com o botão "voltar" do navegador
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) carregarOrcamentos();
    });

    return () => {
      window.removeEventListener("focus", carregarOrcamentos);
      document.removeEventListener("visibilitychange", recarregarSeVisivel);
    };
  }, []);

  useEffect(() => {
    fetch("/api/usuarios", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUsuarios(data.map((u: any) => ({ id: u.id, nome: u.nome || u.name || "", email: u.email })));
        }
      })
      .catch(() => {});
  }, []);

  function atualizarStatus(id: string, novo: StatusOrcamento) {
    setOrcamentos((prev) => prev.map((o) => o.id === id ? { ...o, status: novo } : o));
  }

  async function deletarOrcamento(id: string, numero: string) {
    if (!confirm(`Excluir orçamento #${numero} permanentemente?`)) return;
    try {
      const res = await fetch(`/api/orcamentos/${id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!res.ok) {
        const err = await res.json();
        const msg = err.detalhes || err.error || "Erro ao excluir orçamento.";
        alert(msg);
        return;
      }
      setOrcamentos((prev) => prev.filter((o) => o.id !== id));
    } catch {
      alert("Erro ao excluir orçamento. Verifique sua conexão.");
    }
  }

  const filtrados = orcamentos.filter((o) => {
    if (filtroUsuario && o.userId !== filtroUsuario) return false;
    const q = busca.toLowerCase();
    if (!q) return true;
    // Nomes dos projetos associados via tags
    const projetosNomes = (o.tags || []).map((tagId) => projetosPlanejamento[tagId]?.nome || "").filter(Boolean);
    return (
      o.numero?.toLowerCase().includes(q) ||
      o.nomeProjeto?.toLowerCase().includes(q) ||
      o.cliente?.toLowerCase().includes(q) ||
      o.solicitante?.toLowerCase().includes(q) ||
      projetosNomes.some((nome) => nome.toLowerCase().includes(q))
    );
  });

  const totalGeralReceita = filtrados.reduce((a, o) => a + totalOrcamento(o), 0);
  const totalGeralCusto = filtrados.reduce((a, o) => a + custoTotalOrcamento(o), 0);
  const margemGeral = totalGeralReceita && totalGeralCusto
    ? ((totalGeralReceita - totalGeralCusto) / totalGeralReceita) * 100
    : null;

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Orçamentos</h1>
          <Link href="/novo">
            <button className="bg-[#fb4d06] text-white text-sm font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition">
              + Novo Orçamento
            </button>
          </Link>
        </div>

        {/* Cards resumo */}
        {!carregando && orcamentos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Orçamentos</p>
              <p className="text-2xl font-bold text-gray-800">{filtrados.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Itens</p>
              <p className="text-2xl font-bold text-gray-800">{filtrados.reduce((a, o) => a + o.itens.length, 0)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Valor total</p>
              <p className="text-xl font-bold text-[#fb4d06]">{fmt(totalGeralReceita)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Margem geral</p>
              <p className="text-xl font-bold text-green-700">
                {margemGeral !== null ? `${margemGeral.toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>
        )}

        {/* Busca + Filtro Usuário */}
        {!carregando && orcamentos.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por número, projeto, cliente ou solicitante..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <select
              value={filtroUsuario}
              onChange={(e) => setFiltroUsuario(e.target.value)}
              className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white min-w-[140px]"
            >
              <option value="">Todos usuários</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tabela */}
        {carregando ? (
          <div className="text-center text-gray-400 py-20">Carregando...</div>
        ) : erro ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <p className="text-gray-500">{erro}</p>
            <button
              onClick={carregarOrcamentos}
              className="bg-[#fb4d06] text-white text-sm font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition"
            >
              Tentar novamente
            </button>
          </div>
        ) : orcamentos.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <p className="text-lg mb-2">Nenhum orçamento ainda.</p>
            <Link href="/novo" className="text-[#fb4d06] hover:underline text-sm">Criar primeiro orçamento →</Link>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center text-gray-400 py-10">
            {busca ? `Nenhum resultado para "${busca}"` : filtroUsuario ? "Nenhum orçamento deste usuário" : "Nenhum resultado"}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-white text-xs uppercase">
                  <th className="px-4 py-3 text-left">Nº</th>
                  <th className="px-4 py-3 text-left">Projeto</th>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">PO</th>
                  <th className="px-4 py-3 text-center">OS</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Margem</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                  <th className="px-4 py-3 text-left">Criado por</th>
                  <th className="px-4 py-3 text-center">Part.</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((o, idx) => {
                  const total = totalOrcamento(o);
                  const margem = margemOrcamento(o);
                  return (
                    <tr key={o.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-[#fb4d06] bg-[#fb4d06]/5 px-2 py-0.5 rounded-full whitespace-nowrap">
                          #{o.numero}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{o.nomeProjeto || o.cliente || "—"}</div>
                        <div className="text-xs text-gray-400">{o.cliente}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{o.dataOrcamento}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusDropdown
                          orcamentoId={o.id}
                          statusAtual={o.status || "Em andamento"}
                          onChange={(novo) => atualizarStatus(o.id, novo)}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {o.documentos && o.documentos.length > 0 ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <a
                              href={`/api/orcamentos/${o.id}/documentos/${o.documentos[0].id}?inline=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] font-semibold text-blue-500 hover:text-blue-700 hover:underline transition"
                            >
                              disponível
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <a
                          href={`/api/pdf/${o.id}?tipo=os`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg transition"
                          title="Baixar Ordem de Serviço"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          OS
                        </a>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#fb4d06] whitespace-nowrap">
                        {fmt(total)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {margem !== null ? (
                          <span className={`text-xs font-bold ${margem >= 35 ? "text-green-600" : margem >= 20 ? "text-yellow-600" : "text-red-500"}`}>
                            {margem.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-0.5">
                          <Link href={`/orcamentos/${o.id}`}>
                            <button
                              className="p-1.5 rounded-lg text-gray-400 hover:text-[#fb4d06] hover:bg-[#fb4d06]/5 transition"
                              title="Editar orçamento"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </Link>
                          <DownloadDropdown orcamentoId={o.id} />
                          <button
                            onClick={(e) => { e.preventDefault(); deletarOrcamento(o.id, o.numero || ""); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                            title="Excluir orçamento"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <AvatarIniciais nome={o.userName || "?"} size="sm" />
                          <span>{o.userName || "—"}</span>
                          {o.userId === user?.id && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Eu</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ParticipantesAvatar participantes={o.participantes || []} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filtrados.length > 1 && (
                <tfoot>
                  <tr className="bg-gray-800 text-white">
                    <td colSpan={6} className="px-4 py-3 text-xs font-semibold uppercase text-right">Total geral</td>
                    <td className="px-4 py-3 text-right font-bold text-yellow-400 whitespace-nowrap">{fmt(totalGeralReceita)}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-400">
                      {margemGeral !== null ? `${margemGeral.toFixed(1)}%` : "—"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </main>
    </WorkspaceLayout>
  );
}
