"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";
import type { Fornecedor } from "@/app/types";

export default function ListaFornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState(false ? "" : "");
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    fetch("/api/fornecedores")
      .then((r) => r.json())
      .then((d) => { setFornecedores(d); setCarregando(false); });
  }, []);

  const filtrados = fornecedores.filter((f) => {
    const q = filtro.toLowerCase();
    return (
      f.nomeFantasia?.toLowerCase().includes(q) ||
      f.razaoSocial?.toLowerCase().includes(q) ||
      f.categoria?.toLowerCase().includes(q) ||
      f.cidade?.toLowerCase().includes(q)
    );
  });

  const ativos = fornecedores.filter((f) => f.status === "Ativo").length;

  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Fornecedores</h1>
            <p className="text-gray-500 text-sm mt-0.5">{ativos} ativos · {fornecedores.length} cadastrados</p>
          </div>
          <Link href="/fornecedores/novo">
            <button className="bg-[#fb4d06] text-white text-sm font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition">
              + Novo Fornecedor
            </button>
          </Link>
        </div>

        {/* Busca */}
        {!carregando && fornecedores.length > 0 && (
          <div className="relative mb-5">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nome, categoria ou cidade..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
        )}

        {carregando ? (
          <div className="text-center text-gray-400 py-20">Carregando...</div>
        ) : fornecedores.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-gray-500 mb-3">Nenhum fornecedor cadastrado ainda.</p>
            <Link href="/fornecedores/novo" className="text-[#fb4d06] hover:underline text-sm">Cadastrar primeiro fornecedor →</Link>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center text-gray-400 py-10">Nenhum resultado para &quot;{filtro}&quot;</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtrados.map((f) => (
              <Link key={f.id} href={`/fornecedores/${f.id}`}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-[#fb4d06]/20 transition cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800 truncate">{f.nomeFantasia || f.razaoSocial}</h3>
                      {f.nomeFantasia && <p className="text-xs text-gray-400 truncate">{f.razaoSocial}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ml-2 shrink-0 ${
                      f.status === "Ativo"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {f.status}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs text-gray-500">
                    {f.categoria && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
                        </svg>
                        {f.categoria}
                      </div>
                    )}
                    {f.cidade && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        {f.cidade}{f.estado ? ` · ${f.estado}` : ""}
                      </div>
                    )}
                    {f.nomeContato && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {f.nomeContato}
                      </div>
                    )}
                    {f.prazoEntregaDias && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Entrega: {f.prazoEntregaDias} dias
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
