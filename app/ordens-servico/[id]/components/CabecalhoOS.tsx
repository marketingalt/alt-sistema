"use client";

import type { OrdemServico, Cliente } from "@/app/types";
import UserAutocomplete from "@/app/components/UserAutocomplete";
import MultiUserSelect from "@/app/components/MultiUserSelect";

interface Props {
  os: OrdemServico;
  cliente?: Cliente | null;
  onUpdateOS?: (updates: Partial<OrdemServico>) => void;
}

export default function CabecalhoOS({ os, cliente, onUpdateOS }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {/* Número da OS + datas */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">OS #{os.numero}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Vinculada ao orçamento <span className="font-semibold text-gray-700">#{os.orcamentoNumero}</span>
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>
            <span className="text-gray-400">Criação: </span>
            {new Date(os.createdAt).toLocaleDateString("pt-BR")}
          </p>
          <p>
            <span className="text-gray-400">Entrega: </span>
            {os.prazoEntrega}
          </p>
          <p>
            <span className="text-gray-400">Pagamento: </span>
            {os.prazoPagamento}
          </p>
        </div>
      </div>

      {/* Cliente info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
        <div>
          <p className="text-[10px] font-semibold uppercase text-gray-500 tracking-wide mb-0.5">Cliente</p>
          <p className="text-sm font-semibold text-gray-800">{os.cliente || "—"}</p>
          {cliente && (
            <div className="text-xs text-gray-500 mt-1 space-y-0.5">
              {cliente.cnpj && <p>CNPJ: {cliente.cnpj}</p>}
              {cliente.nomeContato && <p>Contato: {cliente.nomeContato}</p>}
              {cliente.emailContato && <p>Email: {cliente.emailContato}</p>}
              {cliente.whatsappContato && <p>WhatsApp: {cliente.whatsappContato}</p>}
            </div>
          )}
          {!cliente && (
            <p className="text-xs text-gray-400 italic mt-1">Cliente não encontrado no cadastro</p>
          )}
        </div>
        <div className="md:text-right">
          <p className="text-[10px] font-semibold uppercase text-gray-500 tracking-wide mb-0.5">Solicitante</p>
          <p className="text-sm text-gray-800">{os.solicitante || "—"}</p>
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase text-gray-500 tracking-wide mb-1">Responsável</p>
            {onUpdateOS ? (
              <UserAutocomplete
                value={os.responsavel || ""}
                onChange={(nome) => onUpdateOS({ responsavel: nome })}
                placeholder="Buscar usuário..."
                displayNome
              />
            ) : (
              <p className="text-sm text-gray-800">{os.responsavel || "—"}</p>
            )}
          </div>
        </div>
      </div>

      {/* Participantes */}
      <div className="mt-4">
        {onUpdateOS ? (
          <MultiUserSelect
            value={os.participantes || []}
            onChange={(participantes) => onUpdateOS({ participantes })}
            label="Participantes"
            placeholder="Adicionar participante..."
          />
        ) : (
          <div>
            <p className="text-[10px] font-semibold uppercase text-gray-500 tracking-wide mb-2">Participantes</p>
            {os.participantes?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {os.participantes.map((p) => (
                  <span key={p.userId} className="inline-flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1 text-xs text-gray-700">
                    {p.nome}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">—</p>
            )}
          </div>
        )}
      </div>

      {/* Observações */}
      {os.observacoes && (
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase text-gray-500 tracking-wide mb-1">Observações</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl p-3 border border-gray-100">
            {os.observacoes}
          </p>
        </div>
      )}
    </div>
  );
}
