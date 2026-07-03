"use client";

export default function ContasPagarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 max-w-lg w-full p-8">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-800 text-center mb-2">Erro em Contas a Pagar</h2>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-xs font-mono text-red-700 whitespace-pre-wrap break-all">
            {error.message || "Erro desconhecido"}
          </p>
        </div>
        <button
          onClick={reset}
          className="w-full py-2.5 rounded-xl bg-[#fb4d06] text-white text-sm font-semibold hover:opacity-90"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
