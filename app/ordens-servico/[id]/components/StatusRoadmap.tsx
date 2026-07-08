"use client";

import type { StatusOS } from "@/app/types";

interface RoadmapModuloProps {
  titulo: string;
  chave: string;
  icone: React.ReactNode;
  status: string;
  cor: string;
  bgCor: string;
  detalhes?: string;
  editavel?: boolean;
  onStatusChange?: (novo: string) => void;
  opcoes?: string[];
  onDocumentos?: (chave: string) => void;
}

function Modulo({
  titulo,
  chave,
  icone,
  status,
  cor,
  bgCor,
  detalhes,
  editavel,
  onStatusChange,
  opcoes,
  onDocumentos,
}: RoadmapModuloProps) {
  return (
    <div className={`flex-1 min-w-0 rounded-2xl border p-4 ${bgCor} relative group`}>
      {/* Cabeçalho clicável — abre documentos da área */}
      <button
        type="button"
        onClick={() => onDocumentos?.(chave)}
        className="flex items-center gap-2 text-sm font-semibold mb-2 w-full text-left hover:opacity-80 transition"
        style={{ color: cor }}
      >
        <span className="w-5 h-5 shrink-0">{icone}</span>
        <span className="truncate">{titulo}</span>
        <span className="ml-auto opacity-0 group-hover:opacity-100 transition shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </span>
      </button>

      {editavel && onStatusChange && opcoes ? (
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="w-full text-sm font-medium px-2 py-1.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 cursor-pointer"
          style={{ color: cor }}
        >
          {opcoes.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <button
          type="button"
          onClick={() => onDocumentos?.(chave)}
          className="text-sm font-medium w-full text-left hover:opacity-80 transition"
          style={{ color: cor }}
        >
          {status}
        </button>
      )}

      {detalhes && <p className="text-xs text-gray-500 mt-1 truncate">{detalhes}</p>}

      {/* Botão de documentos na parte inferior (fallback visível) */}
      <button
        type="button"
        onClick={() => onDocumentos?.(chave)}
        className="mt-2 flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase opacity-0 group-hover:opacity-100 transition hover:underline"
        style={{ color: cor }}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Documentos
      </button>
    </div>
  );
}

interface Props {
  osStatus: StatusOS;
  orcamentoStatus?: string;
  financeiroColuna?: string;
  planejamentoColuna?: string;
  onStatusOSChange?: (novo: StatusOS) => void;
  fornecedorStatus?: string;
  onFornecedorStatusChange?: (novo: string) => void;
  onModuleClick?: (modulo: string) => void;
}

export default function StatusRoadmap({
  osStatus,
  orcamentoStatus,
  financeiroColuna,
  planejamentoColuna,
  onStatusOSChange,
  fornecedorStatus,
  onFornecedorStatusChange,
  onModuleClick,
}: Props) {
  const STATUS_OS_OPCOES: StatusOS[] = ["Pendente", "Em produção", "Pronto", "Entregue", "Cancelada"];
  const FORNECEDOR_OPCOES = [
    "Aguardando orçamento",
    "Orçamento enviado",
    "Confirmado",
    "Em produção",
    "Aguardando coleta",
    "Entregue",
  ];

  const modulos = [
    {
      chave: "orcamento",
      titulo: "Orçamento",
      status: orcamentoStatus || "—",
      cor: "#2563eb",
      bgCor: "bg-blue-50 border-blue-200",
      icone: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      chave: "financeiro",
      titulo: "Financeiro",
      status: financeiroColuna || "—",
      cor: "#059669",
      bgCor: "bg-green-50 border-green-200",
      icone: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      chave: "fornecedor",
      titulo: "Fornecedor",
      status: fornecedorStatus || "Pendente",
      cor: "#d97706",
      bgCor: "bg-yellow-50 border-yellow-200",
      editavel: true,
      opcoes: FORNECEDOR_OPCOES,
      onStatusChange: onFornecedorStatusChange,
      icone: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      chave: "os",
      titulo: "Status da OS",
      status: osStatus,
      cor: "#9333ea",
      bgCor: "bg-purple-50 border-purple-200",
      editavel: true,
      opcoes: STATUS_OS_OPCOES,
      onStatusChange: (v: string) => onStatusOSChange?.(v as StatusOS),
      icone: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      chave: "planejamento",
      titulo: "Planejamento",
      status: planejamentoColuna || "—",
      cor: "#db2777",
      bgCor: "bg-pink-50 border-pink-200",
      icone: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {modulos.map((mod) => (
        <Modulo
          key={mod.chave}
          chave={mod.chave}
          titulo={mod.titulo}
          icone={mod.icone}
          status={mod.status}
          cor={mod.cor}
          bgCor={mod.bgCor}
          editavel={mod.editavel}
          opcoes={mod.opcoes}
          onStatusChange={mod.editavel ? mod.onStatusChange : undefined}
          onDocumentos={onModuleClick}
        />
      ))}
    </div>
  );
}
