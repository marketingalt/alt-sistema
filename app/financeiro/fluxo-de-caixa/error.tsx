"use client";

export default function FluxoError({
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-800 text-center mb-2">Erro ao carregar Fluxo de Caixa</h2>
        <p className="text-sm text-gray-500 text-center mb-4">Ocorreu um erro inesperado. Detalhes abaixo:</p>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-xs font-mono text-red-700 whitespace-pre-wrap break-all">
            {error.message || "Erro desconhecido"}
          </p>
          {error.digest && (
            <p className="text-[10px] text-red-500 mt-2 font-mono">Digest: {error.digest}</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 py-2.5 rounded-xl bg-[#fb4d06] text-white text-sm font-semibold hover:opacity-90 transition"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}
