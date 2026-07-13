"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";

// ── Tipos ──

interface ReembolsoDespesa {
  id: string;
  data: string;
  cliente: string;
  ordemServicoId?: string;
  ordemServicoNumero?: string;
  descricao: string;
  valor: number;
  pagamento: "cartao_corporativo_c6" | "cartao_corporativo_nubank" | "cartao_pessoal";
  aprovadoPor: string;
  aprovadoPorNome: string;
  status: "pendente" | "pago";
  dataPagamento?: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
}

interface OrdemServico {
  id: string;
  numero: string;
  cliente: string;
}

const PAGAMENTO_OPCOES = [
  { value: "cartao_corporativo_c6", label: "Cartão Corporativo C6" },
  { value: "cartao_corporativo_nubank", label: "Cartão Corporativo Nubank" },
  { value: "cartao_pessoal", label: "Cartão Pessoal" },
] as const;

const PAGAMENTO_LABEL: Record<string, string> = {
  cartao_corporativo_c6: "C6 Corp.",
  cartao_corporativo_nubank: "Nubank Corp.",
  cartao_pessoal: "Cartão Pessoal",
};

function fmt(v: number) {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

// ── Componente principal ──

export default function ReembolsosPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [reembolsos, setReembolsos] = useState<ReembolsoDespesa[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // ── Form state ──
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split("T")[0],
    cliente: "",
    ordemServicoId: "",
    ordemServicoNumero: "",
    descricao: "",
    valor: "",
    pagamento: "cartao_corporativo_c6" as string,
    aprovadoPor: "",
  });
  const [buscaOS, setBuscaOS] = useState("");
  const [showOSDropdown, setShowOSDropdown] = useState(false);

  // ── Edit state ──
  const [editando, setEditando] = useState<ReembolsoDespesa | null>(null);
  const [editForm, setEditForm] = useState({
    data: "",
    cliente: "",
    ordemServicoId: "",
    ordemServicoNumero: "",
    descricao: "",
    valor: "",
    pagamento: "",
    aprovadoPor: "",
    status: "pendente" as string,
  });
  const [buscaOSEdit, setBuscaOSEdit] = useState("");

  // ── Auth redirect ──
  useEffect(() => {
    if (isLoaded && !user) router.push("/sign-in");
  }, [isLoaded, user, router]);

  // ── Carregar dados ──
  const carregar = useCallback(() => {
    setCarregando(true);
    Promise.all([
      fetch("/api/reembolsos-despesas").then((r) => r.json()),
      fetch("/api/usuarios").then((r) => r.json()),
      fetch("/api/ordens-servico").then((r) => r.json()),
    ])
      .then(([reembolsosData, usuariosData, osData]: [ReembolsoDespesa[], Usuario[], OrdemServico[]]) => {
        setReembolsos(reembolsosData);
        setUsuarios(usuariosData);
        setOrdensServico(osData);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (isLoaded && user) carregar();
  }, [isLoaded, user, carregar]);

  // ── Criar reembolso ──
  async function handleCriar() {
    if (!formData.cliente || !formData.descricao || !formData.valor || !formData.aprovadoPor) return;

    setSalvando(true);
    try {
      const res = await fetch("/api/reembolsos-despesas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          valor: parseFloat(formData.valor) || 0,
          aprovadoPorNome: usuarios.find((u) => u.id === formData.aprovadoPor)?.nome || "",
          createdByName: user?.fullName || user?.firstName || "",
        }),
      });
      if (res.ok) {
        setShowModal(false);
        resetForm();
        carregar();
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao criar reembolso");
      }
    } catch {
      alert("Erro ao criar reembolso");
    } finally {
      setSalvando(false);
    }
  }

  // ── Atualizar reembolso ──
  async function handleAtualizar() {
    if (!editando) return;
    setSalvando(true);
    try {
      const res = await fetch("/api/reembolsos-despesas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editando.id,
          data: editForm.data,
          cliente: editForm.cliente,
          ordemServicoId: editForm.ordemServicoId || undefined,
          ordemServicoNumero: editForm.ordemServicoNumero || undefined,
          descricao: editForm.descricao,
          valor: parseFloat(editForm.valor) || 0,
          pagamento: editForm.pagamento,
          aprovadoPor: editForm.aprovadoPor,
          aprovadoPorNome: usuarios.find((u) => u.id === editForm.aprovadoPor)?.nome || "",
          status: editForm.status,
        }),
      });
      if (res.ok) {
        setEditando(null);
        carregar();
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao atualizar reembolso");
      }
    } catch {
      alert("Erro ao atualizar reembolso");
    } finally {
      setSalvando(false);
    }
  }

  // ── Deletar reembolso ──
  async function handleDeletar(id: string) {
    if (!confirm("Tem certeza que deseja excluir este reembolso?")) return;
    try {
      const res = await fetch(`/api/reembolsos-despesas?id=${id}`, { method: "DELETE" });
      if (res.ok) carregar();
    } catch {
      alert("Erro ao excluir reembolso");
    }
  }

  // ── Marcar como pago ──
  async function handlePagar(reb: ReembolsoDespesa) {
    try {
      const res = await fetch("/api/reembolsos-despesas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: reb.id,
          status: "pago",
          dataPagamento: new Date().toISOString().split("T")[0],
        }),
      });
      if (res.ok) carregar();
    } catch {
      alert("Erro ao pagar reembolso");
    }
  }

  function resetForm() {
    setFormData({
      data: new Date().toISOString().split("T")[0],
      cliente: "",
      ordemServicoId: "",
      ordemServicoNumero: "",
      descricao: "",
      valor: "",
      pagamento: "cartao_corporativo_c6",
      aprovadoPor: "",
    });
    setBuscaOS("");
  }

  function abrirEdicao(reb: ReembolsoDespesa) {
    setEditando(reb);
    setEditForm({
      data: reb.data,
      cliente: reb.cliente,
      ordemServicoId: reb.ordemServicoId || "",
      ordemServicoNumero: reb.ordemServicoNumero || "",
      descricao: reb.descricao,
      valor: String(reb.valor),
      pagamento: reb.pagamento,
      aprovadoPor: reb.aprovadoPor,
      status: reb.status,
    });
    setBuscaOSEdit(reb.ordemServicoNumero || "");
  }

  // ── Filtragem de OS ──
  const osFiltradas = ordensServico.filter(
    (os) =>
      os.numero.toLowerCase().includes(buscaOS.toLowerCase()) ||
      os.cliente?.toLowerCase().includes(buscaOS.toLowerCase())
  );
  const osFiltradasEdit = ordensServico.filter(
    (os) =>
      os.numero.toLowerCase().includes(buscaOSEdit.toLowerCase()) ||
      os.cliente?.toLowerCase().includes(buscaOSEdit.toLowerCase())
  );

  // ── Totais ──
  const totalPendente = reembolsos
    .filter((r) => r.status === "pendente")
    .reduce((a, r) => a + r.valor, 0);
  const totalPago = reembolsos
    .filter((r) => r.status === "pago")
    .reduce((a, r) => a + r.valor, 0);

  if (!isLoaded || !user) return null;

  return (
    <WorkspaceLayout>
      <main className="px-4 md:px-8 py-8 w-full max-w-full">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Reembolsos</h1>
            <p className="text-gray-500 text-sm">Despesas operacionais e reembolsos diversos</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#fb4d06] text-white text-sm font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Reembolso
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Pendente</p>
            <p className="text-xl font-bold text-amber-600 mt-1">{fmt(totalPendente)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Pago</p>
            <p className="text-xl font-bold text-green-600 mt-1">{fmt(totalPago)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Geral</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{fmt(totalPendente + totalPago)}</p>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">OS</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descritivo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pagamento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aprovado por</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {carregando ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">
                      Carregando...
                    </td>
                  </tr>
                ) : reembolsos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">
                      Nenhum reembolso encontrado.
                    </td>
                  </tr>
                ) : (
                  reembolsos.map((reb) => (
                    <tr key={reb.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {new Date(reb.data + "T12:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[120px] truncate">{reb.cliente}</td>
                      <td className="px-4 py-3">
                        {reb.ordemServicoNumero ? (
                          <a
                            href={`/ordens-servico/${reb.ordemServicoId}`}
                            className="text-xs font-semibold text-blue-600 hover:underline"
                          >
                            OS #{reb.ordemServicoNumero}
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate" title={reb.descricao}>
                        {reb.descricao}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                        {fmt(reb.valor)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-xs">
                        {PAGAMENTO_LABEL[reb.pagamento] || reb.pagamento}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">{reb.aprovadoPorNome}</td>
                      <td className="px-4 py-3 text-center">
                        {reb.status === "pago" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-green-100 text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Pago
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-amber-100 text-amber-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {reb.status === "pendente" && (
                            <button
                              onClick={() => handlePagar(reb)}
                              className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition"
                              title="Marcar como pago"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => abrirEdicao(reb)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeletar(reb.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Excluir"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ═══ MODAL: NOVO REEMBOLSO ═══ */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-12 pb-12 overflow-y-auto"
          onClick={() => { setShowModal(false); resetForm(); }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800">Novo Reembolso</h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Data */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                />
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={formData.cliente}
                  onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                  placeholder="Nome do cliente"
                />
              </div>

              {/* OS */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 mb-1">OS (opcional)</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={buscaOS}
                  onChange={(e) => {
                    setBuscaOS(e.target.value);
                    setShowOSDropdown(true);
                    if (!e.target.value) {
                      setFormData({ ...formData, ordemServicoId: "", ordemServicoNumero: "" });
                    }
                  }}
                  onFocus={() => setShowOSDropdown(true)}
                  placeholder="Buscar OS por número ou cliente..."
                />
                {formData.ordemServicoNumero && (
                  <p className="text-xs text-blue-600 mt-0.5">OS #{formData.ordemServicoNumero} selecionada</p>
                )}
                {showOSDropdown && buscaOS && osFiltradas.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {osFiltradas.map((os) => (
                      <button
                        key={os.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 transition"
                        onClick={() => {
                          setFormData({ ...formData, ordemServicoId: os.id, ordemServicoNumero: os.numero });
                          setBuscaOS(`OS #${os.numero} - ${os.cliente || ""}`);
                          setShowOSDropdown(false);
                        }}
                      >
                        <span className="font-semibold">OS #{os.numero}</span>
                        {os.cliente && <span className="text-gray-500 ml-1">— {os.cliente}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Descritivo */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Descritivo da Despesa</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none min-h-[60px] focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descreva a despesa..."
                />
              </div>

              {/* Valor */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>

              {/* Pagamento */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Pagamento</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={formData.pagamento}
                  onChange={(e) => setFormData({ ...formData, pagamento: e.target.value })}
                >
                  {PAGAMENTO_OPCOES.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
              </div>

              {/* Aprovado por */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Aprovado por</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={formData.aprovadoPor}
                  onChange={(e) => setFormData({ ...formData, aprovadoPor: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-sm font-semibold py-2 px-4 rounded-lg text-gray-500 hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCriar}
                disabled={salvando || !formData.cliente || !formData.descricao || !formData.valor || !formData.aprovadoPor}
                className="bg-[#fb4d06] text-white text-sm font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Criar Reembolso"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: EDITAR REEMBOLSO ═══ */}
      {editando && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-12 pb-12 overflow-y-auto"
          onClick={() => setEditando(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800">Editar Reembolso</h2>
              <button
                onClick={() => setEditando(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Data */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={editForm.data}
                  onChange={(e) => setEditForm({ ...editForm, data: e.target.value })}
                />
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={editForm.cliente}
                  onChange={(e) => setEditForm({ ...editForm, cliente: e.target.value })}
                />
              </div>

              {/* OS */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 mb-1">OS (opcional)</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={buscaOSEdit}
                  onChange={(e) => {
                    setBuscaOSEdit(e.target.value);
                    if (!e.target.value) {
                      setEditForm({ ...editForm, ordemServicoId: "", ordemServicoNumero: "" });
                    }
                  }}
                  placeholder="Buscar OS por número ou cliente..."
                />
                {editForm.ordemServicoNumero && (
                  <p className="text-xs text-blue-600 mt-0.5">OS #{editForm.ordemServicoNumero} selecionada</p>
                )}
                {buscaOSEdit && osFiltradasEdit.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {osFiltradasEdit.map((os) => (
                      <button
                        key={os.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 transition"
                        onClick={() => {
                          setEditForm({ ...editForm, ordemServicoId: os.id, ordemServicoNumero: os.numero });
                          setBuscaOSEdit(`OS #${os.numero} - ${os.cliente || ""}`);
                        }}
                      >
                        <span className="font-semibold">OS #{os.numero}</span>
                        {os.cliente && <span className="text-gray-500 ml-1">— {os.cliente}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Descritivo */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Descritivo da Despesa</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none min-h-[60px] focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={editForm.descricao}
                  onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                />
              </div>

              {/* Valor */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={editForm.valor}
                  onChange={(e) => setEditForm({ ...editForm, valor: e.target.value })}
                />
              </div>

              {/* Pagamento */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Pagamento</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={editForm.pagamento}
                  onChange={(e) => setEditForm({ ...editForm, pagamento: e.target.value })}
                >
                  {PAGAMENTO_OPCOES.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
              </div>

              {/* Aprovado por */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Aprovado por</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={editForm.aprovadoPor}
                  onChange={(e) => setEditForm({ ...editForm, aprovadoPor: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditando(null)}
                className="text-sm font-semibold py-2 px-4 rounded-lg text-gray-500 hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleAtualizar}
                disabled={salvando || !editForm.cliente || !editForm.descricao || !editForm.valor || !editForm.aprovadoPor}
                className="bg-[#fb4d06] text-white text-sm font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
}
