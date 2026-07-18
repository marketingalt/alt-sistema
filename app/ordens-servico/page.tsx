"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import AvatarIniciais from "@/app/components/AvatarIniciais";
import ParticipantesAvatar from "@/app/components/ParticipantesAvatar";
import { STATUS_OS_CONFIG, type OrdemServico, type StatusOS } from "@/app/types";

function Icone({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
    </svg>
  );
}

const STATUS_OS_LIST: StatusOS[] = ["Pendente", "Em produção", "Pronto", "Entregue", "Cancelada"];

export default function OrdensServicoPage() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<StatusOS | "">("");
  const [usuarios, setUsuarios] = useState<{ id: string; name: string }[]>([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const { user } = useUser();

  async function carregar() {
    try {
      const res = await fetch("/api/ordens-servico");
      if (res.ok) {
        const data = await res.json();
        setOrdens(data);
      }
    } catch { /* fallback */ }
    finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setUsuarios(data))
      .catch(() => {});
  }, []);

  const filtradas = (filtroStatus ? ordens.filter((o) => o.status === filtroStatus) : ordens)
    .filter((o) => {
      if (!filtroUsuario) return true;
      if (filtroUsuario === "meus") return o.userId === user?.id;
      return o.userId === filtroUsuario;
    });

  // Totais por OS
  const totalCustoOS = (os: OrdemServico) =>
    os.itens.reduce((acc, item) => acc + item.totalCusto, 0);

  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Ordens de Serviço</h1>
            <p className="text-sm text-gray-500 mt-1">
              {ordens.length} OS registrada{ordens.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm font-medium text-gray-500">Filtrar:</span>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setFiltroStatus("")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                filtroStatus === "" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              Todas
            </button>
            {STATUS_OS_LIST.map((s) => (
              <button
                key={s}
                onClick={() => setFiltroStatus(s)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                  filtroStatus === s ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
                style={filtroStatus === s ? { backgroundColor: STATUS_OS_CONFIG[s].dot.replace("bg-", "") } : undefined}
              >
                {s}
              </button>
            ))}
          </div>
          <select
            value={filtroUsuario}
            onChange={(e) => setFiltroUsuario(e.target.value)}
            className="ml-auto text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
          >
            <option value="">👤 Todos</option>
            <option value="meus">🙋 Meus registros</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Tabela */}
        {carregando ? (
          <p className="text-gray-500 text-sm">Carregando...</p>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
            <Icone d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-800 font-semibold mb-1">Nenhuma OS encontrada</p>
            <p className="text-gray-500 text-sm">As OS são geradas automaticamente ao aprovar um orçamento.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nº OS</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Orçamento</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Custos</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Criação</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Criado por</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Participantes</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((os) => (
                    <tr key={os.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                      <td className="px-4 py-3">
                        <Link href={`/ordens-servico/${os.id}`} className="font-semibold text-[#fb4d06] hover:underline">
                          OS #{os.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <Link href={`/orcamentos/${os.orcamentoId}`} className="hover:text-[#fb4d06] transition">
                          #{os.orcamentoNumero}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{os.cliente}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                            STATUS_OS_CONFIG[os.status]?.cor || "text-gray-700"
                          } ${STATUS_OS_CONFIG[os.status]?.bg || "bg-gray-50"}`}
                        >
                          {os.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatarMoeda(totalCustoOS(os))}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(os.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <AvatarIniciais nome={os.userName || "?"} size="sm" />
                          <span className="text-xs text-gray-500">{os.userName || "—"}</span>
                          {os.userId === user?.id && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Eu</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ParticipantesAvatar participantes={os.participantes} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/ordens-servico/${os.id}`}
                          className="text-xs font-semibold text-[#fb4d06] hover:bg-[#fb4d06]/10 px-3 py-1.5 rounded-lg transition"
                        >
                          Detalhes
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </WorkspaceLayout>
  );
}
