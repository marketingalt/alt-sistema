"use client";

import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function SignInPage() {
  const { signIn, fetchStatus } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Se já estiver autenticado, redireciona
  useEffect(() => {
    if (signIn?.status === "complete") {
      router.replace("/");
    }
  }, [signIn?.status, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn || !email.trim() || !password) return;

    setLoading(true);
    setError("");

    try {
      // 1. Criar tentativa de sign-in com o email
      const createResult = await signIn.create({ identifier: email.trim() });
      if (createResult.error) {
        setError(createResult.error.message || "Erro ao iniciar login.");
        setLoading(false);
        return;
      }

      // 2. Enviar a senha
      const pwResult = await signIn.password({ password });
      if (pwResult.error) {
        setError(pwResult.error.message || "Senha incorreta.");
        setLoading(false);
        return;
      }

      // 3. Finalizar sign-in se completo
      if (signIn.status === "complete") {
        const finalizeResult = await signIn.finalize();
        if (finalizeResult.error) {
          setError(finalizeResult.error.message || "Erro ao finalizar login.");
          setLoading(false);
          return;
        }

        try {
          localStorage.setItem("remember_me", String(rememberMe));
        } catch {}

        router.push("/");
      } else {
        setError("Falha na autenticação. Tente novamente.");
      }
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        "Erro ao fazer login. Verifique suas credenciais.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const carregando = !signIn || fetchStatus === "fetching";

  return (
    <div className="min-h-screen flex">
      {/* Lado esquerdo — branding */}
      <div className="hidden lg:flex w-1/2 bg-black flex-col items-center justify-center px-12">
        <div className="mb-10 text-center">
          <div className="mb-6">
            <span className="text-5xl font-bold text-[#fb4d06] tracking-tight">Omini</span>
            <span className="text-5xl font-bold text-[#fb4d06] tracking-tight ml-2">Alt</span>
          </div>
          <p className="text-gray-400 text-lg">Sistema interno de gestão</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {[
            "Orçamentos com IA",
            "Controle financeiro integrado",
            "Geração de PDFs profissionais",
          ].map((f) => (
            <div key={f} className="flex items-center gap-3 text-gray-400 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#fb4d06] shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Lado direito — formulário */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <div className="lg:hidden text-center mb-2">
            <span className="text-3xl font-bold text-[#fb4d06] tracking-tight">Omini</span>
            <span className="text-3xl font-bold text-[#fb4d06] tracking-tight ml-1.5">Alt</span>
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="seu@email.com"
                autoFocus
                autoComplete="email"
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06] transition bg-white"
              />
            </div>

            {/* Senha */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 focus:border-[#fb4d06] transition bg-white"
              />
            </div>

            {/* Manter conectado */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setRememberMe((p) => !p)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                  rememberMe
                    ? "bg-[#fb4d06] border-[#fb4d06]"
                    : "border-gray-300 bg-white"
                }`}
              >
                {rememberMe && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-600">Manter-me conectado</span>
            </label>

            {/* Erro */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading || carregando}
              className="w-full bg-[#fb4d06] text-white font-bold py-3 px-6 rounded-xl hover:bg-[#e04400] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Entrando...</>
              ) : carregando ? (
                "Carregando..."
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
