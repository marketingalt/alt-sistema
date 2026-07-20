"use client";

import type { HistoricoAlteracao } from "@/app/types";

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
        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
      );
    case "status":
      return (
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </div>
      );
    case "edicao":
      return (
        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
      );
  }
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
    <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
      {ordenado.map((entry) => (
        <div key={entry.id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition">
          {iconeTipo(entry.tipo)}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-800">{entry.descricao}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {entry.usuarioNome} · {formatRelativeTime(new Date(entry.timestamp))}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
