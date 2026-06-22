"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";

type Aba = "reembolsos" | "entregas";

interface DadosBancarios {
  nome: string;
  banco: string;
  chavePix: string;
  agencia: string;
  conta: string;
}

interface Reembolso {
  id: string;
  loteId: string;
  motorista: string;
  email: string;
  dadosBancarios: DadosBancarios;
  odometroInicial: number;
  dataInicial: string;
  origem: string;
  odometroFinal: number;
  dataFinal: string;
  destino: string;
  distanciaKm: number;
  valorKm: number;
  total: number;
  motivo: string;
  observacao: string;
  status: "pendente" | "pago";
  comprovante: { id: string; nome: string; tipo: string; tamanho: number } | null;
  contaPagarId: string | null;
  dataVencimento: string;
  dataPagamento?: string;
  createdAt: string;
}

interface MotoristaHeader {
  nome: string;
  email: string;
  banco: string;
  chavePix: string;
  agencia: string;
  conta: string;
}

const HEADER_STORAGE_KEY = "logistica_motorista";

function motoristaPadrao(user: { fullName?: string | null; primaryEmailAddress?: { emailAddress?: string } | null }): MotoristaHeader {
  return {
    nome: user.fullName || "",
    email: user.primaryEmailAddress?.emailAddress || "",
    banco: "C6 BANK",
    chavePix: "",
    agencia: "",
    conta: "",
  };
}

// ── Itens de formulário para novo lote ──
interface ItemLote {
  key: string;
  odometroInicial: number;
  dataInicial: string;
  origem: string;
  odometroFinal: number;
  dataFinal: string;
  destino: string;
  distanciaKm: number;
  valorKm: number;
  total: number;
  motivo: string;
  observacao: string;
}

function itemLoteVazio(): ItemLote {
  const hoje = new Date().toISOString().split("T")[0];
  return {
    key: Math.random().toString(36).substring(2, 8),
    odometroInicial: 0,
    dataInicial: hoje,
    origem: "",
    odometroFinal: 0,
    dataFinal: hoje,
    destino: "",
    distanciaKm: 0,
    valorKm: 0,
    total: 0,
    motivo: "",
    observacao: "",
  };
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtNum(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LogisticaPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [aba, setAba] = useState<Aba>("reembolsos");
  const [motorista, setMotorista] = useState<MotoristaHeader>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(HEADER_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return { nome: "", email: "", banco: "C6 BANK", chavePix: "", agencia: "", conta: "" };
  });
  const [editandoMotorista, setEditandoMotorista] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) router.replace("/sign-in");
    // Preencher motorista com dados do usuário logado se ainda vazio
    if (user && !motorista.nome) {
      const padrao = motoristaPadrao(user);
      setMotorista(padrao);
      localStorage.setItem(HEADER_STORAGE_KEY, JSON.stringify(padrao));
    }
  }, [isLoaded, user]);

  function salvarMotorista(dados: MotoristaHeader) {
    setMotorista(dados);
    localStorage.setItem(HEADER_STORAGE_KEY, JSON.stringify(dados));
    setEditandoMotorista(false);
  }

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Logística</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie entregas e reembolsos dos motoristas.</p>
        </div>

        {/* ── Cabeçalho Motorista ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Responsável / Motorista</h2>
            <button
              onClick={() => setEditandoMotorista(!editandoMotorista)}
              className="text-xs font-medium text-[#fb4d06] hover:underline"
            >
              {editandoMotorista ? "Cancelar" : "Editar"}
            </button>
          </div>

          {editandoMotorista ? (
            <MotoristaForm dados={motorista} onSave={salvarMotorista} />
          ) : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Nome:</span>
                <span className="font-medium text-gray-800">{motorista.nome || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Email:</span>
                <span className="text-gray-600">{motorista.email || "—"}</span>
              </div>
              {motorista.chavePix && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Pix:</span>
                  <span className="text-gray-600">{motorista.chavePix}</span>
                </div>
              )}
              {motorista.banco && motorista.banco !== "C6 BANK" && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Banco:</span>
                  <span className="text-gray-600">{motorista.banco}</span>
                </div>
              )}
              {(motorista.agencia || motorista.conta) && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Ag: {motorista.agencia || "—"} CC: {motorista.conta || "—"}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Abas */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {[
            { key: "reembolsos" as Aba, label: "Reembolsos" },
            { key: "entregas" as Aba, label: "Minhas Entregas" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition ${
                aba === key
                  ? "border-[#fb4d06] text-[#fb4d06]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {aba === "reembolsos" && <AbaReembolsos motorista={motorista} />}
        {aba === "entregas" && <AbaEntregas />}
      </main>
    </WorkspaceLayout>
  );
}

// ═══════════════════════════════════════════════════════════
// Componente: Formulário de Motorista (inline)
// ═══════════════════════════════════════════════════════════

function MotoristaForm({ dados, onSave }: { dados: MotoristaHeader; onSave: (d: MotoristaHeader) => void }) {
  const [form, setForm] = useState(dados);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nome</label>
        <input
          type="text"
          value={form.nome}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Banco</label>
        <input
          type="text"
          value={form.banco}
          onChange={(e) => setForm((f) => ({ ...f, banco: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Chave Pix</label>
        <input
          type="text"
          value={form.chavePix}
          onChange={(e) => setForm((f) => ({ ...f, chavePix: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
          placeholder="CPF, email ou telefone"
        />
      </div>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Ag / Conta</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.agencia}
              onChange={(e) => setForm((f) => ({ ...f, agencia: e.target.value }))}
              className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
              placeholder="Ag"
            />
            <input
              type="text"
              value={form.conta}
              onChange={(e) => setForm((f) => ({ ...f, conta: e.target.value }))}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
              placeholder="Conta"
            />
          </div>
        </div>
        <button
          onClick={() => onSave(form)}
          className="bg-[#fb4d06] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition whitespace-nowrap"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ABA: Reembolsos
// ═══════════════════════════════════════════════════════════

function AbaReembolsos({ motorista }: { motorista: MotoristaHeader }) {
  const [reembolsos, setReembolsos] = useState<Reembolso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState<string | null>(null);
  const [items, setItems] = useState<ItemLote[]>([itemLoteVazio()]);
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    setCarregando(true);
    fetch("/api/reembolsos")
      .then((r) => r.json())
      .then(setReembolsos)
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregar(); }, []);

  function addItem() {
    setItems((prev) => [...prev, itemLoteVazio()]);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function updateItem(key: string, campo: keyof ItemLote, valor: string | number) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        const updated = { ...i, [campo]: valor };

        // Auto-cálculo: distância = odômetro final - inicial
        if (campo === "odometroInicial" || campo === "odometroFinal") {
          const odomIni = campo === "odometroInicial" ? Number(valor) : i.odometroInicial;
          const odomFim = campo === "odometroFinal" ? Number(valor) : i.odometroFinal;
          updated.distanciaKm = Math.max(0, odomFim - odomIni);
        }

        // Auto-cálculo: total = distância × valor km
        if (campo === "distanciaKm" || campo === "valorKm") {
          const dist = campo === "distanciaKm" ? Number(valor) : i.distanciaKm;
          const vKm = campo === "valorKm" ? Number(valor) : i.valorKm;
          updated.total = dist * vKm;
        }

        // Se odometro mudou, recalcula também o total
        if (campo === "odometroInicial" || campo === "odometroFinal") {
          updated.total = updated.distanciaKm * updated.valorKm;
        }

        return updated;
      })
    );
  }

  function recalcularItem(key: string) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        const dist = Math.max(0, i.odometroFinal - i.odometroInicial);
        const total = dist * i.valorKm;
        return { ...i, distanciaKm: dist, total };
      })
    );
  }

  async function criarLote() {
    const validos = items.filter((i) => i.origem.trim() && i.destino.trim() && i.total > 0);
    if (validos.length === 0) {
      alert("Preencha pelo menos um item com origem, destino e valor km.");
      return;
    }

    if (!motorista.nome.trim()) {
      alert("Preencha os dados do motorista no cabeçalho antes de criar reembolsos.");
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch("/api/reembolsos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lote: true,
          motorista: motorista,
          itens: validos.map((i) => ({
            motorista: motorista.nome.trim(),
            email: motorista.email.trim(),
            dadosBancarios: {
              nome: motorista.nome.trim(),
              banco: motorista.banco,
              chavePix: motorista.chavePix,
              agencia: motorista.agencia,
              conta: motorista.conta,
            },
            odometroInicial: i.odometroInicial,
            dataInicial: i.dataInicial,
            origem: i.origem.trim(),
            odometroFinal: i.odometroFinal,
            dataFinal: i.dataFinal,
            destino: i.destino.trim(),
            distanciaKm: i.distanciaKm,
            valorKm: i.valorKm,
            total: i.total,
            motivo: i.motivo.trim(),
            observacao: i.observacao.trim(),
            dataVencimento: i.dataFinal,
          })),
        }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      alert(`Lote criado com ${data.reembolsos.length} reembolso(s)! Já foram lançados no Contas a Pagar.`);
      setShowModal(false);
      setItems([itemLoteVazio()]);
      carregar();
    } catch {
      alert("Erro ao criar lote de reembolsos.");
    } finally {
      setSalvando(false);
    }
  }

  async function uploadComprovante(reembolsoId: string, file: File) {
    const formData = new FormData();
    formData.append("arquivo", file);

    try {
      const res = await fetch(`/api/reembolsos/${reembolsoId}/comprovante`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setShowUploadModal(null);
        carregar();
      } else {
        alert("Erro ao fazer upload.");
      }
    } catch {
      alert("Erro ao fazer upload.");
    }
  }

  async function baixarComprovante(reb: Reembolso) {
    const res = await fetch(`/api/reembolsos?download=${reb.id}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = reb.comprovante?.nome || "comprovante";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Totais
  const totalPendente = reembolsos.filter((r) => r.status === "pendente").reduce((a, r) => a + r.total, 0);
  const totalPago = reembolsos.filter((r) => r.status === "pago").reduce((a, r) => a + r.total, 0);
  const totalKm = reembolsos.reduce((a, r) => a + r.distanciaKm, 0);

  if (carregando) {
    return <p className="text-gray-500 text-sm">Carregando reembolsos...</p>;
  }

  return (
    <div>
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Pendentes</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{fmt(totalPendente)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Pagos</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmt(totalPago)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total KM Rodados</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{fmtNum(totalKm)} km</p>
        </div>
      </div>

      {/* Botão novo lote */}
      <div className="mb-4">
        <button
          onClick={() => setShowModal(true)}
          className="bg-[#fb4d06] text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition"
        >
          + Novo Lote de Reembolsos
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Motorista</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Período</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Trajeto</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Distância</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Valor Km</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Total</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Comprovante</th>
              </tr>
            </thead>
            <tbody>
              {reembolsos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    Nenhum reembolso encontrado.
                  </td>
                </tr>
              ) : (
                reembolsos.map((reb) => (
                  <tr key={reb.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 font-medium text-gray-800">{reb.motorista}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(reb.dataInicial + "T12:00:00").toLocaleDateString("pt-BR")}
                      {" → "}
                      {new Date(reb.dataFinal + "T12:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="font-medium">{reb.origem}</span>
                      <span className="text-gray-300 mx-1">→</span>
                      <span className="font-medium">{reb.destino}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {fmtNum(reb.distanciaKm)} km
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {fmt(reb.valorKm)}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-700">
                      {fmt(reb.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {reb.status === "pago" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Pago
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                          </svg>
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {reb.status === "pago" && !reb.comprovante && (
                        <button
                          onClick={() => setShowUploadModal(reb.id)}
                          className="text-xs font-medium text-[#fb4d06] hover:underline"
                        >
                          + Comprovante
                        </button>
                      )}
                      {reb.comprovante && (
                        <button
                          onClick={() => baixarComprovante(reb)}
                          className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1 mx-auto"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          {reb.comprovante.nome.length > 15
                            ? reb.comprovante.nome.substring(0, 15) + "..."
                            : reb.comprovante.nome}
                        </button>
                      )}
                      {reb.status === "pendente" && (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Novo Lote ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-12 pb-12 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800">Novo Lote de Reembolsos</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-5">
              Reembolso de quilometragem rodada. Os valores de <strong>Distância</strong> e <strong>Total</strong> são calculados automaticamente. Todos serão lançados no <strong>Contas a Pagar</strong>.
            </p>

            <div className="space-y-5">
              {items.map((item, idx) => (
                <div key={item.key} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-500 uppercase">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(item.key)} className="text-xs text-red-500 hover:text-red-700">
                        Remover
                      </button>
                    )}
                  </div>

                  {/* Odômetros + Datas + Origem/Destino */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Odômetro Inicial</label>
                      <input
                        type="number"
                        min={0}
                        value={item.odometroInicial || ""}
                        onChange={(e) => updateItem(item.key, "odometroInicial", parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                        placeholder="km"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Data Inicial</label>
                      <input
                        type="date"
                        value={item.dataInicial}
                        onChange={(e) => updateItem(item.key, "dataInicial", e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Origem</label>
                      <input
                        type="text"
                        value={item.origem}
                        onChange={(e) => updateItem(item.key, "origem", e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                        placeholder="Cidade de partida"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Odômetro Final</label>
                      <input
                        type="number"
                        min={0}
                        value={item.odometroFinal || ""}
                        onChange={(e) => updateItem(item.key, "odometroFinal", parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                        placeholder="km"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Data Final</label>
                      <input
                        type="date"
                        value={item.dataFinal}
                        onChange={(e) => updateItem(item.key, "dataFinal", e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Destino</label>
                      <input
                        type="text"
                        value={item.destino}
                        onChange={(e) => updateItem(item.key, "destino", e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                        placeholder="Cidade de chegada"
                      />
                    </div>
                  </div>

                  {/* Cálculos automáticos */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Distância (km)</label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={item.distanciaKm || ""}
                          onChange={(e) => updateItem(item.key, "distanciaKm", parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-blue-50/30"
                          placeholder="Auto"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">km</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Valor Km (R$)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.valorKm || ""}
                        onChange={(e) => updateItem(item.key, "valorKm", parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Total</label>
                      <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-700 font-semibold">
                        {item.total > 0 ? fmt(item.total) : "—"}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Motivo</label>
                      <input
                        type="text"
                        value={item.motivo}
                        onChange={(e) => updateItem(item.key, "motivo", e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30"
                        placeholder="Ex: Visita cliente, Reunião..."
                      />
                    </div>
                  </div>

                  {/* Observação */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Observação</label>
                    <textarea
                      value={item.observacao}
                      onChange={(e) => updateItem(item.key, "observacao", e.target.value)}
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 resize-none"
                      placeholder="Informações adicionais..."
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Botões */}
            <div className="flex items-center justify-between mt-5">
              <button
                onClick={addItem}
                className="text-sm font-medium text-[#fb4d06] hover:underline flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar outro reembolso
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="text-sm font-medium text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={criarLote}
                  disabled={salvando}
                  className="bg-[#fb4d06] text-white font-semibold text-sm px-6 py-2 rounded-xl hover:opacity-90 transition disabled:opacity-50"
                >
                  {salvando ? "Criando..." : `Criar Lote (${items.filter((i) => i.origem.trim() && i.destino.trim() && i.total > 0).length} itens)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Upload Comprovante ── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Anexar Comprovante</h3>
            <label className="cursor-pointer flex flex-col items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl p-8 hover:border-[#fb4d06]/30 transition">
              <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="text-sm text-gray-500">Clique para selecionar o arquivo</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && showUploadModal) uploadComprovante(showUploadModal, file);
                }}
              />
            </label>
            <button
              onClick={() => setShowUploadModal(null)}
              className="mt-4 w-full text-sm font-medium text-gray-500 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ABA: Minhas Entregas (em construção)
// ═══════════════════════════════════════════════════════════

function AbaEntregas() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
      <svg className="w-16 h-16 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      <h3 className="text-lg font-bold text-gray-700 mb-2">Minhas Entregas</h3>
      <p className="text-gray-400 text-sm max-w-sm">
        Esta funcionalidade está em construção. Em breve você poderá gerenciar suas entregas aqui.
      </p>
      <div className="mt-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium">
        🚧 Em desenvolvimento
      </div>
    </div>
  );
}
