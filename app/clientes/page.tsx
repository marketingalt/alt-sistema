"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import type { Cliente, StatusCliente } from "@/app/types";

const STATUS_CORES: Record<StatusCliente, string> = {
  "Ativo": "bg-green-100 text-green-700",
  "Inativo": "bg-gray-100 text-gray-500",
  "Inadimplente": "bg-red-100 text-red-700",
};

export default function ListaClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    fetch("/api/clientes").then((r) => r.json()).then((d) => { setClientes(d); setCarregando(false); });
  }, []);

  const filtrados = clientes.filter((c) => {
    const q = filtro.toLowerCase();
    return c.nomeEmpresa?.toLowerCase().includes(q) ||
      c.razaoSocial?.toLowerCase().includes(q) ||
      c.cidade?.toLowerCase().includes(q) ||
      c.nomeContato?.toLowerCase().includes(q);
  });

  const ativos = clientes.filter((c) => c.status === "Ativo").length;
  const inadimplentes = clientes.filter((c) => c.status === "Inadimplente").length;

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {ativos} ativos · {inadimplentes > 0 && <span className="text-red-500">{inadimplentes} inadimplentes · </span>}{clientes.length} cadastrados
            </p>
          </div>
          <Link href="/clientes/novo">
            <button className="bg-[#fb4d06] text-white text-sm font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition">
              + Novo Cliente
            </button>
          </Link>
        </div>

        {!carregando && clientes.length > 0 && (
          <div className="relative mb-5">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input type="text" placeholder="Buscar por empresa, contato ou cidade..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
              value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          </div>
        )}

        {carregando ? (
          <div className="text-center text-gray-400 py-20">Carregando...</div>
        ) : clientes.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-3">Nenhum cliente cadastrado ainda.</p>
            <Link href="/clientes/novo" className="text-[#fb4d06] hover:underline text-sm">Cadastrar primeiro cliente →</Link>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center text-gray-400 py-10">Nenhum resultado para &quot;{filtro}&quot;</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtrados.map((c) => (
              <Link key={c.id} href={`/clientes/${c.id}`}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-[#fb4d06]/20 transition cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800 truncate">{c.nomeEmpresa || c.razaoSocial}</h3>
                      {c.nomeEmpresa && c.razaoSocial && <p className="text-xs text-gray-400 truncate">{c.razaoSocial}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ml-2 shrink-0 ${STATUS_CORES[c.status || "Ativo"]}`}>
                      {c.status || "Ativo"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 text-xs text-gray-500">
                    {c.nomeContato && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        {c.nomeContato}
                      </div>
                    )}
                    {c.cidade && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                        {c.cidade}{c.estado ? ` · ${c.estado}` : ""}
                      </div>
                    )}
                    {c.formasPagamento?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.formasPagamento.map((f) => (
                          <span key={f} className="bg-[#fb4d06]/5 text-[#fb4d06] px-1.5 py-0.5 rounded text-xs">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </WorkspaceLayout>
  );
}
