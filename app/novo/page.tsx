"use client";

import Link from "next/link";
import WorkspaceLayout from "@/app/components/WorkspaceLayout";

export default function NovoOrcamento() {
  return (
    <WorkspaceLayout>
      <main className="px-8 py-8">
        <div className="w-full max-w-2xl">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Novo Orçamento</h1>
          <p className="text-gray-500 mb-8">Como você quer começar?</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Opção manual */}
            <Link href="/novo/revisar">
              <div className="group bg-white border-2 border-gray-100 hover:border-[#fb4d06]/40 rounded-2xl p-6 cursor-pointer hover:shadow-md transition h-full flex flex-col">
                <div className="w-12 h-12 bg-[#fb4d06]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#fb4d06]/20 transition">
                  <svg className="w-6 h-6 text-[#fb4d06]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-gray-800 mb-1">Novo Orçamento</h2>
                <p className="text-sm text-gray-500 flex-1">
                  Preencha o orçamento manualmente, item por item, com total controle.
                </p>
                <div className="mt-5 flex items-center gap-1 text-sm font-semibold text-[#fb4d06]">
                  Começar agora
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Opção IA */}
            <Link href="/novo/ia">
              <div className="group bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-transparent hover:border-yellow-400/40 rounded-2xl p-6 cursor-pointer hover:shadow-md transition h-full flex flex-col">
                <div className="w-12 h-12 bg-yellow-400/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-yellow-400/30 transition">
                  <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-white mb-1">Analisar com IA</h2>
                <p className="text-sm text-gray-400 flex-1">
                  Cole o email ou pedido do cliente e a IA monta o orçamento automaticamente.
                </p>
                <div className="mt-5 flex items-center gap-1 text-sm font-semibold text-yellow-400">
                  Usar inteligência artificial
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

          </div>
        </div>
      </main>
    </WorkspaceLayout>
  );
}
