"use client";

import type { StatusOS } from "@/app/types";

interface RoadmapModuloProps {
  titulo: string;
  icone: React.ReactNode;
  status: string;
  cor: string;
  bgCor: string;
  detalhes?: string;
  editavel?: boolean;
  onStatusChange?: (novo: string) => void;
  opcoes?: string[];
}

function Modulo({
  titulo,
  icone,
  status,
  cor,
  bgCor,
  detalhes,
  editavel,
  onStatusChange,
  opcoes,
}: RoadmapModuloProps) {
  return (
    <div className={`flex-1 min-w-0 rounded-2xl border p-4 ${bgCor}`}>
      <div className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: cor }}>
        <span className="w-5 h-5">{icone}</span>
        {titulo}
      </div>

      {editavel && onStatusChange && opcoes ? (
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="w-full text-sm font-medium px-2 py-1 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
          style={{ color: cor }}
        >
          {opcoes.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm font-medium" style={{ color: cor }}>
          {status}
        </p>
      )}

      {detalhes && <p className="text-xs text-gray-500 mt-1 truncate">{detalhes}</p>}
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
}

export default function StatusRoadmap({
  osStatus,
  orcamentoStatus,
  financeiroColuna,
  planejamentoColuna,
  onStatusOSChange,
  fornecedorStatus,
  onFornecedorStatusChange,
}: Props) {
  const STATUS_OS_OPCOES: StatusOS[] = ["Pendente", "Em produção", "Pronto", "Entregue", "Cancelada"];
  const FORNECEDOR_OPCOES = ["Aguardando orçamento", "Orçamento enviado", "Confirmado", "Em produção", "Aguardando coleta", "Entregue"];

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {/* Orçamento */}
      <Modulo
        titulo="Orçamento"
        icone={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        }
        status={orcamentoStatus || "—"}
        cor="#2563eb"
        bgCor="bg-blue-50 border-blue-200"
      />

      {/* Financeiro */}
      <Modulo
        titulo="Financeiro"
        icone={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        }
        status={financeiroColuna || "—"}
        cor="#059669"
        bgCor="bg-green-50 border-green-200"
      />

      {/* Fornecedor */}
      <Modulo
        titulo="Fornecedor"
        icone={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
        }
        status={fornecedorStatus || "Pendente"}
        cor="#d97706"
        bgCor="bg-yellow-50 border-yellow-200"
        editavel
        opcoes={FORNECEDOR_OPCOES}
        onStatusChange={onFornecedorStatusChange}
      />

      {/* OS Status */}
      <Modulo
        titulo="Status da OS"
        icone={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        }
        status={osStatus}
        cor="#9333ea"
        bgCor="bg-purple-50 border-purple-200"
        editavel
        opcoes={STATUS_OS_OPCOES}
        onStatusChange={(v) => onStatusOSChange?.(v as StatusOS)}
      />

      {/* Planejamento */}
      <Modulo
        titulo="Planejamento"
        icone={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        }
        status={planejamentoColuna || "—"}
        cor="#db2777"
        bgCor="bg-pink-50 border-pink-200"
      />
    </div>
  );
}
