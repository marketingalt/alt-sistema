"use client";

import type { HistoricoAlteracao } from "@/app/types";
import { STATUS_CONFIG } from "@/app/types";

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days}d`;
  return new Date(date).toLocaleDateString("pt-BR");
}

function iconeTipo(tipo: HistoricoAlteracao["tipo"]) {
  switch (tipo) {
    case "criacao":
      return (
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0 ring-2 ring-green-200">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
      );
    case "status":
      return (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 ring-2 ring-blue-200">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </div>
      );
    case "edicao":
      return (
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 ring-2 ring-amber-200">
          <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
      );
  }
}

/** Extrai um resumo curto (1-2 palavras) a partir da descrição */
function resumirAcao(entry: HistoricoAlteracao): { rotulo: string; detalhe: string } {
  if (entry.tipo === "criacao") return { rotulo: "Criação", detalhe: "Orçamento criado" };

  if (entry.tipo === "status") {
    const de = entry.valorAnterior || "";
    const para = entry.valorNovo || "";
    const cfgDe = de && STATUS_CONFIG[de as keyof typeof STATUS_CONFIG];
    const cfgPara = para && STATUS_CONFIG[para as keyof typeof STATUS_CONFIG];
    return { rotulo: "Status", detalhe: `${de} → ${para}` };
  }

  // Edição: extrai o campo alterado da descrição
  // "Cliente alterado de ..." → "Cliente"
  // "Valor total alterado de ..." → "Valor"
  const campo = entry.descricao.split(" ")[0];
  const rotuloCampo: Record<string, string> = {
    Cliente: "Cliente",
    Projeto: "Projeto",
    Status: "Status",
    Solicita: "Solicitante",
    Responsá: "Responsável",
    Prazo: entry.descricao.includes("pagamento") ? "Prazo Pag." : "Prazo Entrega",
    Valor: "Valor Total",
  };
  const prefixo = Object.entries(rotuloCampo).find(([chave]) => campo.startsWith(chave));
  return { rotulo: prefixo?.[1] || "Edição", detalhe: entry.descricao };
}

function BadgeStatus({ valor }: { valor: string }) {
  const cfg = STATUS_CONFIG[valor as keyof typeof STATUS_CONFIG];
  if (!cfg) return <span className="text-xs font-semibold text-gray-600">{valor}</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.bg} ${cfg.cor} border ${cfg.bg} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {valor}
    </span>
  );
}

function ResumoCompacto({ historico }: { historico: HistoricoAlteracao[] }) {
  const criacoes = historico.filter((e) => e.tipo === "criacao").length;
  const statusChanges = historico.filter((e) => e.tipo === "status").length;
  const edicoes = historico.filter((e) => e.tipo === "edicao").length;
  const total = historico.length;

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 bg-gray-50/50">
      <span className="text-xs text-gray-400 font-medium">{total} no total</span>
      {criacoes > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
          </svg>
          {criacoes} cria{criacoes > 1 ? "ções" : "ção"}
        </span>
      )}
      {statusChanges > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {statusChanges} status
        </span>
      )}
      {edicoes > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          {edicoes} ediç{edicoes > 1 ? "ões" : "ão"}
        </span>
      )}
    </div>
  );
}

export default function HistoricoAtividades({ historico }: { historico?: HistoricoAlteracao[] }) {
  if (!historico || historico.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-400">
        Nenhuma atividade registrada ainda.
      </div>
    );
  }

  const ordenado = [...historico].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div>
      <ResumoCompacto historico={ordenado} />
      <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
      {ordenado.map((entry) => {
        const { rotulo, detalhe } = resumirAcao(entry);
        return (
          <div key={entry.id} className="px-4 py-2.5 flex items-start gap-3 hover:bg-gray-50 transition group">
            {iconeTipo(entry.tipo)}
            <div className="min-w-0 flex-1 flex flex-col gap-0.5">
              {/* Linha superior: rótulo + badge(s) de status */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{rotulo}</span>
                {entry.tipo === "status" && entry.valorAnterior && entry.valorNovo && (
                  <span className="flex items-center gap-1.5 text-xs">
                    <BadgeStatus valor={entry.valorAnterior} />
                    <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <BadgeStatus valor={entry.valorNovo} />
                  </span>
                )}
                {entry.tipo !== "status" && (
                  <span className="text-sm text-gray-700 truncate">{detalhe}</span>
                )}
              </div>
              {/* Linha inferior: usuário + timestamp */}
              <p className="text-[11px] text-gray-400">
                {entry.usuarioNome} · {formatRelativeTime(new Date(entry.timestamp))}
              </p>
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}
