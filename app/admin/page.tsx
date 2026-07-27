"use client";

import { useEffect, useState } from "react";
import type { ClerkUserWithRole, SystemSettings } from "@/lib/admin";
import type { CampoDinamicoDef } from "@/app/types";

type Aba = "usuarios" | "registros" | "configuracoes" | "os-campos";

// ── Ícones SVG inline (consistente com o resto do projeto) ──

function Icone(props: { d: string; className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={props.d} />
    </svg>
  );
}

const ICONES = {
  usuarios: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  registros: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  configuracoes: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  "os-campos": "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
};

// ── Badge ──

function BadgeAdmin() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-[#fb4d06]/10 text-[#fb4d06] border border-[#fb4d06]/20">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      Admin
    </span>
  );
}

function BadgeUsuario() {
  return (
    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
      Usuário
    </span>
  );
}

// ── Componente principal ──

export default function AdminPage() {
  const [aba, setAba] = useState<Aba>("usuarios");

  return (
    <main className="px-8 py-8 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Administração</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie usuários, visualize dados do sistema e configure opções gerais.</p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-8 border-b border-gray-200">
        {(
          [
            { key: "usuarios" as Aba, label: "Usuários" },
            { key: "registros" as Aba, label: "Registros" },
            { key: "configuracoes" as Aba, label: "Configurações" },
            { key: "os-campos" as Aba, label: "Campos da OS" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setAba(key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition ${
              aba === key
                ? "border-[#fb4d06] text-[#fb4d06]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Icone d={ICONES[key]} className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {aba === "usuarios" && <AbaUsuarios />}
      {aba === "registros" && <AbaRegistros />}
      {aba === "configuracoes" && <AbaConfiguracoes />}
      {aba === "os-campos" && <AbaCamposOS />}
    </main>
  );
}

// ═══════════════════════════════════════════════════════════
// ABA: Usuários
// ═══════════════════════════════════════════════════════════

function AbaUsuarios() {
  const [usuarios, setUsuarios] = useState<ClerkUserWithRole[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [alterando, setAlterando] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/usuarios");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao carregar");
      }
      setUsuarios(await res.json());
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function excluirUsuario(targetUserId: string) {
    setExcluindo(targetUserId);
    try {
      const res = await fetch(`/api/admin/usuarios?userId=${targetUserId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao excluir usuário");
      } else {
        await carregar();
      }
    } catch {
      alert("Erro de rede ao excluir usuário");
    } finally {
      setExcluindo(null);
    }
  }

  async function alternarRole(targetUserId: string, novaRole: "admin" | "user") {
    const confirmar = novaRole === "user"
      ? confirm("Tem certeza que deseja rebaixar este usuário? Ele perderá acesso ao painel de administração.")
      : confirm("Tem certeza que deseja promover este usuário a administrador?");

    if (!confirmar) return;

    setAlterando(targetUserId);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, role: novaRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao alterar permissão");
      } else {
        await carregar();
      }
    } catch {
      alert("Erro de rede ao alterar permissão");
    } finally {
      setAlterando(null);
    }
  }

  if (carregando) {
    return <p className="text-gray-500 text-sm">Carregando usuários...</p>;
  }

  if (erro) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-2">{erro}</p>
        <button onClick={carregar} className="text-sm text-[#fb4d06] hover:underline">Tentar novamente</button>
      </div>
    );
  }

  if (usuarios.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
        <Icone d={ICONES.usuarios} className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Nenhum usuário encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {usuarios.map((u) => (
        <UsuarioRow
          key={u.id}
          usuario={u}
          alterando={alterando === u.id || excluindo === u.id}
          onAlterarRole={(novaRole) => alternarRole(u.id, novaRole)}
          onExcluir={() => excluirUsuario(u.id)}
          onAlterarPermissoes={(novasPerms) => {
            setAlterando(u.id);
            fetch("/api/admin/usuarios", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ targetUserId: u.id, permissoes: novasPerms }),
            })
              .then((r) => {
                if (!r.ok) throw new Error();
                return carregar();
              })
              .catch(() => alert("Erro ao alterar permissões"))
              .finally(() => setAlterando(null));
          }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Componente individual de usuário com permissões editáveis
// ═══════════════════════════════════════════════════════════

const MODULOS_INFO = [
  { key: "orcamentos" as const, label: "Orçamentos", cor: "text-blue-600 bg-blue-50 border-blue-200" },
  { key: "clientes" as const, label: "Clientes", cor: "text-purple-600 bg-purple-50 border-purple-200" },
  { key: "fornecedores" as const, label: "Fornecedores", cor: "text-cyan-600 bg-cyan-50 border-cyan-200" },
  { key: "produtos" as const, label: "Produtos", cor: "text-amber-600 bg-amber-50 border-amber-200" },
  { key: "planejamento" as const, label: "Planejamento", cor: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  { key: "financeiro" as const, label: "Financeiro", cor: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { key: "faturamento" as const, label: "Faturamentos", cor: "text-rose-600 bg-rose-50 border-rose-200" },
  { key: "logistica" as const, label: "Logística", cor: "text-orange-600 bg-orange-50 border-orange-200" },
  { key: "rh" as const, label: "RH", cor: "text-pink-600 bg-pink-50 border-pink-200" },
];

function UsuarioRow({
  usuario,
  alterando,
  onAlterarRole,
  onAlterarPermissoes,
  onExcluir,
}: {
  usuario: ClerkUserWithRole;
  alterando: boolean;
  onAlterarRole: (role: "admin" | "user") => void;
  onAlterarPermissoes: (permissoes: string[]) => void;
  onExcluir: () => void;
}) {
  const [editandoPerms, setEditandoPerms] = useState(false);
  const [pendingPerms, setPendingPerms] = useState<string[]>(usuario.permissoes);
  const ehAdmin = usuario.role === "admin";

  function togglePerm(key: string) {
    setPendingPerms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  }

  function salvarPerms() {
    onAlterarPermissoes(pendingPerms);
    setEditandoPerms(false);
  }

  function cancelarPerms() {
    setPendingPerms(usuario.permissoes);
    setEditandoPerms(false);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-4">
        {/* Info do usuário */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div className="w-9 h-9 rounded-full bg-[#fb4d06]/10 flex items-center justify-center text-xs font-bold text-[#fb4d06] shrink-0">
            {usuario.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800 text-sm">{usuario.nome}</span>
              {ehAdmin ? <BadgeAdmin /> : <BadgeUsuario />}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{usuario.email}</p>
          </div>
        </div>

        {/* Ações role */}
        <div className="shrink-0 flex items-center gap-1">
          {ehAdmin ? (
            <button
              onClick={() => onAlterarRole("user")}
              disabled={alterando}
              className="text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              {alterando ? "Alterando..." : "Rebaixar"}
            </button>
          ) : (
            <button
              onClick={() => onAlterarRole("admin")}
              disabled={alterando}
              className="text-xs font-medium text-[#fb4d06] hover:text-[#e04400] hover:bg-[#fb4d06]/5 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              {alterando ? "Alterando..." : "Promover a Admin"}
            </button>
          )}
          <button
            onClick={() => {
              if (confirm(`Tem certeza que deseja excluir o usuário "${usuario.nome}"? Esta ação não pode ser desfeita.`)) {
                onExcluir();
              }
            }}
            disabled={alterando}
            className="text-xs font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg transition disabled:opacity-50"
            title="Excluir usuário"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Permissões de módulos */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Acesso aos módulos
          </span>
          {!editandoPerms && !ehAdmin && (
            <button
              onClick={() => setEditandoPerms(true)}
              className="text-[11px] font-medium text-[#fb4d06] hover:underline"
            >
              Editar permissões
            </button>
          )}
          {ehAdmin && (
            <span className="text-[11px] text-gray-400 italic">Admin tem acesso total</span>
          )}
        </div>

        {editandoPerms ? (
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {MODULOS_INFO.map((mod) => {
                const ativo = pendingPerms.includes(mod.key);
                return (
                  <button
                    key={mod.key}
                    type="button"
                    onClick={() => togglePerm(mod.key)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                      ativo
                        ? `${mod.cor}`
                        : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {mod.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={salvarPerms}
                disabled={alterando}
                className="text-xs font-semibold bg-[#fb4d06] text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                {alterando ? "Salvando..." : "Salvar"}
              </button>
              <button
                onClick={cancelarPerms}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {ehAdmin
              ? MODULOS_INFO.map((mod) => (
                  <span
                    key={mod.key}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${mod.cor}`}
                  >
                    {mod.label}
                  </span>
                ))
              : MODULOS_INFO.map((mod) => {
                  const ativo = usuario.permissoes.includes(mod.key);
                  return ativo ? (
                    <span
                      key={mod.key}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${mod.cor}`}
                    >
                      {mod.label}
                    </span>
                  ) : (
                    <span
                      key={mod.key}
                      className="text-xs px-2.5 py-1 rounded-md border border-dashed border-gray-200 text-gray-300"
                    >
                      {mod.label}
                    </span>
                  );
                })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ABA: Registros
// ═══════════════════════════════════════════════════════════

type DataCounts = Record<string, number>;

const MODULOS: { chave: string; label: string; href: string; cor: string; icone: string }[] = [
  { chave: "orcamentos", label: "Orçamentos", href: "/orcamentos", cor: "text-blue-600 bg-blue-50", icone: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { chave: "orcamentosAprovados", label: "Aprovados", href: "/orcamentos", cor: "text-green-600 bg-green-50", icone: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { chave: "orcamentosPendentes", label: "Pendentes", href: "/orcamentos", cor: "text-yellow-600 bg-yellow-50", icone: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { chave: "clientes", label: "Clientes", href: "/clientes", cor: "text-purple-600 bg-purple-50", icone: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { chave: "fornecedores", label: "Fornecedores", href: "/fornecedores", cor: "text-cyan-600 bg-cyan-50", icone: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { chave: "produtos", label: "Produtos", href: "/produtos", cor: "text-amber-600 bg-amber-50", icone: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { chave: "contasAPagar", label: "Contas a Pagar", href: "/financeiro/contas-a-pagar", cor: "text-red-600 bg-red-50", icone: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  { chave: "faturamentos", label: "Faturamentos", href: "/financeiro/faturamentos", cor: "text-indigo-600 bg-indigo-50", icone: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { chave: "fluxoCaixaLancamentos", label: "Fluxo de Caixa", href: "/financeiro/fluxo-de-caixa", cor: "text-emerald-600 bg-emerald-50", icone: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" },
  { chave: "logistica", label: "Logística", href: "/logistica", cor: "text-orange-600 bg-orange-50", icone: "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" },
];

function AbaRegistros() {
  const [counts, setCounts] = useState<DataCounts | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch("/api/admin/registros");
        if (res.ok) {
          setCounts(await res.json());
        }
      } catch {
        // fallback silencioso
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  if (carregando) {
    return <p className="text-gray-500 text-sm">Carregando dados do sistema...</p>;
  }

  if (!counts) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
        <Icone d={ICONES.registros} className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Não foi possível carregar os dados.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {MODULOS.map((mod) => {
        const valor = counts[mod.chave];
        if (valor === undefined) return null;
        return (
          <a
            key={mod.chave}
            href={mod.href}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{mod.label}</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{valor}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${mod.cor} flex items-center justify-center group-hover:scale-110 transition`}>
                <Icone d={mod.icone} className="w-5 h-5" />
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ABA: Configurações
// ═══════════════════════════════════════════════════════════

const PRAZOS_PAGAMENTO = [
  "À vista",
  "7 dias",
  "14 dias",
  "21 dias",
  "30 dias",
  "45 dias",
  "60 dias",
  "30/60 dias",
  "30/60/90 dias",
];

function AbaConfiguracoes() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/admin/configuracoes")
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => setErro("Erro ao carregar configurações"))
      .finally(() => setCarregando(false));
  }, []);

  function atualizar(caminho: string[], valor: number | string | string[]) {
    if (!settings) return;
    const novo = { ...settings };
    let obj: any = novo;
    for (let i = 0; i < caminho.length - 1; i++) {
      obj = obj[caminho[i]];
    }
    obj[caminho[caminho.length - 1]] = valor;
    setSalvo(false);
    setSettings(novo);
  }

  async function salvar() {
    if (!settings) return;
    setSalvando(true);
    setSalvo(false);
    setErro("");
    try {
      // Preserva logos salvas por componentes independentes (LogoUpload, LogoOrcamentoUpload)
      const currentRes = await fetch("/api/admin/configuracoes");
      const currentSettings: SystemSettings = await currentRes.json();
      const merged = { ...currentSettings, ...settings, logoBase64: currentSettings.logoBase64, logoOrcamentoPadrao: currentSettings.logoOrcamentoPadrao };
      const res = await fetch("/api/admin/configuracoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch {
      setErro("Erro ao salvar configurações");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <p className="text-gray-500 text-sm">Carregando configurações...</p>;
  }

  if (!settings) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
        <p className="text-gray-500">{erro || "Erro ao carregar configurações."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Taxas Padrão */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Taxas Padrão</h2>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Honorários (%)" valor={settings.taxasPadrao.honorarios} onChange={(v) => atualizar(["taxasPadrao", "honorarios"], v)} />
          <Campo label="Impostos (%)" valor={settings.taxasPadrao.impostos} onChange={(v) => atualizar(["taxasPadrao", "impostos"], v)} />
          <Campo label="Comissão (%)" valor={settings.taxasPadrao.comissao} onChange={(v) => atualizar(["taxasPadrao", "comissao"], v)} />
          <Campo label="Margem Padrão (%)" valor={settings.taxasPadrao.margemPadrao} onChange={(v) => atualizar(["taxasPadrao", "margemPadrao"], v)} />
        </div>
      </section>

      {/* Frete */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Frete</h2>
        <Campo
          label="Valor por KM (R$)"
          valor={settings.frete.valorKm}
          onChange={(v) => atualizar(["frete", "valorKm"], v)}
          step="0.01"
        />
      </section>

      {/* Prazos */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Prazos</h2>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prazo de Pagamento Padrão</label>
            <select
              value={settings.prazos.pagamentoPadrao}
              onChange={(e) => atualizar(["prazos", "pagamentoPadrao"], e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
            >
              {PRAZOS_PAGAMENTO.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <CampoTexto
            label="Prazo de Entrega Padrão"
            valor={settings.prazos.entregaPadrao}
            onChange={(v) => atualizar(["prazos", "entregaPadrao"], v)}
          />
        </div>
      </section>

      {/* Bancos */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Bancos</h2>
        <p className="text-sm text-gray-500 mb-4">
          Gerencie as opções de banco disponíveis nos formulários de Fluxo de Caixa e Contas a Pagar.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {(settings.bancos || []).map((banco) => (
            <span
              key={banco}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-700"
            >
              {banco}
              <button
                type="button"
                onClick={() => {
                  const novos = (settings.bancos || []).filter((b: string) => b !== banco);
                  atualizar(["bancos"], novos);
                }}
                className="text-gray-400 hover:text-red-500 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            id="novo-banco"
            placeholder="Nome do banco"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#fb4d06]"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const input = e.currentTarget;
              const nome = input.value.trim();
              if (!nome) return;
              if ((settings.bancos || []).includes(nome)) return;
              atualizar(["bancos"], [...(settings.bancos || []), nome]);
              input.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => {
              const input = document.getElementById("novo-banco") as HTMLInputElement;
              const nome = input?.value?.trim();
              if (!nome) return;
              if ((settings.bancos || []).includes(nome)) return;
              atualizar(["bancos"], [...(settings.bancos || []), nome]);
              input.value = "";
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-xl hover:bg-gray-700 transition"
          >
            Adicionar
          </button>
        </div>
      </section>

      {/* Logo do Documento */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Logo do Documento</h2>
        <p className="text-sm text-gray-500 mb-4">
          Faça upload de uma logo que aparecerá no cabeçalho dos documentos (PDFs e previews).
        </p>
        <LogoUpload />
      </section>

      {/* Logo Padrão de Orçamentos */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Logo Padrão de Orçamentos</h2>
        <p className="text-sm text-gray-500 mb-4">
          Logo que aparece por padrão nos orçamentos. Cada orçamento pode ter a sua própria independente.
        </p>
        <LogoOrcamentoUpload />
      </section>

      {/* Ações */}
      <div className="flex items-center gap-4">
        <button
          onClick={salvar}
          disabled={salvando}
          className="bg-[#fb4d06] text-white font-semibold py-2.5 px-6 rounded-xl hover:opacity-90 transition disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar Configurações"}
        </button>
        {salvo && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Configurações salvas!
          </span>
        )}
        {erro && <span className="text-sm text-red-500">{erro}</span>}
      </div>
    </div>
  );
}

function LogoUpload() {
  const [logo, setLogo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/admin/logo")
      .then((r) => r.json())
      .then((data) => {
        if (data.logoBase64) setLogo(data.logoBase64);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  async function uploadLogo(file: File) {
    const reader = new FileReader();
    setEnviando(true);
    reader.onload = async () => {
      const b64 = reader.result as string;
      try {
        const res = await fetch("/api/admin/logo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logoBase64: b64 }),
        });
        if (res.ok) setLogo(b64);
        else alert("Erro ao salvar logo");
      } catch {
        alert("Erro ao salvar logo");
      } finally {
        setEnviando(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function removerLogo() {
    setEnviando(true);
    try {
      const res = await fetch("/api/admin/logo", { method: "DELETE" });
      if (res.ok) setLogo(null);
    } catch {
      alert("Erro ao remover logo");
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <p className="text-sm text-gray-400">Carregando...</p>;

  return (
    <div className="flex items-center gap-6">
      {logo ? (
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="Logo" className="h-20 w-auto rounded-lg border border-gray-200 p-2 bg-white" />
          <button
            onClick={removerLogo}
            disabled={enviando}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition disabled:opacity-50"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="h-20 w-40 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 text-xs">
          Nenhuma logo
        </div>
      )}
      <label className="cursor-pointer bg-white border border-gray-200 text-sm font-semibold text-gray-700 px-4 py-2 rounded-xl hover:border-[#fb4d06]/30 hover:text-[#fb4d06] transition">
        {enviando ? "Enviando..." : logo ? "Trocar Logo" : "Selecionar Imagem"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={enviando}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadLogo(file);
          }}
        />
      </label>
    </div>
  );
}

function LogoOrcamentoUpload() {
  const [logo, setLogo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/admin/logo-orcamento")
      .then((r) => r.json())
      .then((data) => {
        if (data.logoBase64) setLogo(data.logoBase64);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  async function uploadLogo(file: File) {
    const reader = new FileReader();
    setEnviando(true);
    reader.onload = async () => {
      const b64 = reader.result as string;
      try {
        const res = await fetch("/api/admin/logo-orcamento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logoBase64: b64 }),
        });
        if (res.ok) setLogo(b64);
        else alert("Erro ao salvar logo");
      } catch {
        alert("Erro ao salvar logo");
      } finally {
        setEnviando(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function removerLogo() {
    setEnviando(true);
    try {
      const res = await fetch("/api/admin/logo-orcamento", { method: "DELETE" });
      if (res.ok) setLogo(null);
    } catch {
      alert("Erro ao remover logo");
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <p className="text-sm text-gray-400">Carregando...</p>;

  return (
    <div className="flex items-center gap-6">
      {logo ? (
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="Logo orçamentos" className="h-20 w-auto rounded-lg border border-gray-200 p-2 bg-white" />
          <button
            onClick={removerLogo}
            disabled={enviando}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition disabled:opacity-50"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="h-20 w-40 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 text-xs">
          Nenhuma logo
        </div>
      )}
      <label className="cursor-pointer bg-white border border-gray-200 text-sm font-semibold text-gray-700 px-4 py-2 rounded-xl hover:border-[#fb4d06]/30 hover:text-[#fb4d06] transition">
        {enviando ? "Enviando..." : logo ? "Trocar Logo" : "Selecionar Imagem"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={enviando}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadLogo(file);
          }}
        />
      </label>
    </div>
  );
}


// ── Campos reutilizáveis ──

function Campo({ label, valor, onChange, step }: { label: string; valor: number; onChange: (v: number) => void; step?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        value={valor}
        step={step || "1"}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
      />
    </div>
  );
}

function CampoTexto({ label, valor, onChange }: { label: string; valor: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06]"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ABA: CAMPOS DINÂMICOS DA OS
// ═══════════════════════════════════════════════════════════

function AbaCamposOS() {
  const [campos, setCampos] = useState<CampoDinamicoDef[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/admin/configuracoes")
      .then((r) => r.json())
      .then((data: SystemSettings) => setCampos(data.osCamposDinamicos || []))
      .catch(() => setErro("Erro ao carregar campos"))
      .finally(() => setCarregando(false));
  }, []);

  function gerarId() {
    return Math.random().toString(36).substring(2, 10);
  }

  function adicionar() {
    const nome = prompt("Nome do campo:");
    if (!nome?.trim()) return;
    const tipo = prompt("Tipo (texto|textarea|numero|checkbox|select|multiselect|data|anexo|medida):") || "texto";
    const grupo = prompt("Grupo (detalhamento|checklist|interno|materiais):") || "detalhamento";
    const opcoesStr = (tipo === "select" || tipo === "multiselect") ? prompt("Opções separadas por vírgula:") : "";
    const opcoes = opcoesStr ? opcoesStr.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    const novo: CampoDinamicoDef = {
      id: gerarId(),
      nome: nome.trim(),
      tipo: tipo as any,
      grupo: grupo as any,
      visivelCliente: true,
      visivelImpressao: true,
      ordem: campos.length,
    };
    if (opcoes) novo.opcoes = opcoes;
    setCampos([...campos, novo]);
    setSalvo(false);
  }

  function editar(campo: CampoDinamicoDef) {
    const nome = prompt("Nome:", campo.nome);
    if (!nome?.trim()) return;
    const opcoesStr = (campo.tipo === "select" || campo.tipo === "multiselect")
      ? prompt("Opções separadas por vírgula:", campo.opcoes?.join(",") || "") : undefined;
    const opcoes = opcoesStr ? opcoesStr.split(",").map((s) => s.trim()).filter(Boolean) : campo.opcoes;
    setCampos(campos.map((c) =>
      c.id === campo.id
        ? { ...c, nome: nome.trim(), opcoes, visivelCliente: c.visivelCliente, visivelImpressao: c.visivelImpressao }
        : c
    ));
    setSalvo(false);
  }

  function toggleFlag(id: string, flag: "visivelCliente" | "visivelImpressao") {
    setCampos(campos.map((c) => (c.id === id ? { ...c, [flag]: !c[flag] } : c)));
    setSalvo(false);
  }

  function remover(id: string) {
    if (!confirm("Excluir este campo?")) return;
    setCampos(campos.filter((c) => c.id !== id));
    setSalvo(false);
  }

  function moverParaCima(index: number) {
    if (index === 0) return;
    const novo = [...campos];
    [novo[index - 1], novo[index]] = [novo[index], novo[index - 1]];
    novo.forEach((c, i) => (c.ordem = i));
    setCampos(novo);
    setSalvo(false);
  }

  function moverParaBaixo(index: number) {
    if (index >= campos.length - 1) return;
    const novo = [...campos];
    [novo[index], novo[index + 1]] = [novo[index + 1], novo[index]];
    novo.forEach((c, i) => (c.ordem = i));
    setCampos(novo);
    setSalvo(false);
  }

  async function salvar() {
    setSalvando(true);
    setSalvo(false);
    setErro("");
    try {
      const res = await fetch("/api/admin/configuracoes");
      const settings: SystemSettings = await res.json();
      settings.osCamposDinamicos = campos;
      const putRes = await fetch("/api/admin/configuracoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!putRes.ok) throw new Error("Erro ao salvar");
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch {
      setErro("Erro ao salvar campos");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <p className="text-gray-500 text-sm">Carregando campos...</p>;
  }

  const agrupados = new Map<string, CampoDinamicoDef[]>();
  for (const c of campos) {
    const g = c.grupo || "detalhamento";
    if (!agrupados.has(g)) agrupados.set(g, []);
    agrupados.get(g)!.push(c);
  }

  const ROTULO_GRUPO: Record<string, string> = {
    detalhamento: "Por Item (aparece em cada item do orçamento)",
    checklist: "Checklist Geral (checkboxes de conferência)",
    interno: "Área Interna (não visível ao cliente)",
    materiais: "Materiais do Estoque",
  };

  return (
    <div className="max-w-3xl space-y-6">
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {erro}
        </div>
      )}

      {["detalhamento", "checklist", "interno", "materiais"].map((grupo) => {
        const itens = agrupados.get(grupo) || [];
        return (
          <section key={grupo} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1 capitalize">{grupo}</h3>
            <p className="text-xs text-gray-500 mb-4">{ROTULO_GRUPO[grupo]}</p>

            {itens.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nenhum campo neste grupo.</p>
            ) : (
              <div className="space-y-2">
                {itens.map((campo, idx) => (
                  <div
                    key={campo.id}
                    className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"
                  >
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moverParaCima(idx)} className="text-gray-400 hover:text-gray-600 p-0.5" disabled={idx === 0}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button onClick={() => moverParaBaixo(idx)} className="text-gray-400 hover:text-gray-600 p-0.5" disabled={idx >= itens.length - 1}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{campo.nome}</span>
                        <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{campo.tipo}</span>
                        {campo.opcoes && campo.opcoes.length > 0 && (
                          <span className="text-[10px] text-gray-500">({campo.opcoes.join(", ")})</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleFlag(campo.id, "visivelCliente")}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-lg border ${
                        campo.visivelCliente ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"
                      }`}
                      title={campo.visivelCliente ? "Visível ao cliente" : "Oculto do cliente"}
                    >
                      Cliente
                    </button>
                    <button
                      onClick={() => toggleFlag(campo.id, "visivelImpressao")}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-lg border ${
                        campo.visivelImpressao ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"
                      }`}
                      title={campo.visivelImpressao ? "Aparece na impressão" : "Não sai na impressão"}
                    >
                      Imprimir
                    </button>

                    <button onClick={() => editar(campo)} className="text-gray-400 hover:text-gray-600 p-1" title="Editar">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => remover(campo.id)} className="text-gray-400 hover:text-red-500 p-1" title="Excluir">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <button
        onClick={adicionar}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-[#fb4d06]/30 hover:text-[#fb4d06] transition bg-white/50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Adicionar Campo
      </button>

      <div className="flex items-center gap-3 pb-8">
        <button
          onClick={salvar}
          disabled={salvando}
          className="bg-[#fb4d06] text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar Campos"}
        </button>
        {salvo && <span className="text-sm text-green-600 font-medium">Salvo com sucesso!</span>}
      </div>
    </div>
  );
}
