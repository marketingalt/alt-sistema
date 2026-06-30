"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import SistemaLogo from "@/app/components/SistemaLogo";

export default function AcessoNegado() {
  const { signOut } = useClerk();
  const { user } = useUser();

  const email = user?.emailAddresses[0]?.emailAddress || "";

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="mb-8">
          <SistemaLogo
            width={180}
            height={50}
            className="mx-auto object-contain"
          />
        </div>

        {/* Ícone */}
        <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Acesso não autorizado</h1>

        <p className="text-gray-400 mb-2">
          A conta <span className="text-white font-medium">{email}</span> não tem permissão para acessar esta plataforma.
        </p>

        <p className="text-gray-600 text-sm mb-8">
          O acesso é restrito a usuários com email <span className="text-gray-400">@altmkt.com.br</span>.<br />
          Entre em contato com o administrador se você acredita que isso é um erro.
        </p>

        <button
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
          className="bg-[#fb4d06] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#e04400] transition w-full"
        >
          Entrar com outra conta
        </button>
      </div>
    </div>
  );
}
