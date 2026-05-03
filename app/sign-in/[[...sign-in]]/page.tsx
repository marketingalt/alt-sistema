import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex">
      {/* Lado esquerdo — branding */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-gray-900 via-gray-900 to-purple-900 flex-col items-center justify-center px-12">
        <div className="mb-8">
          <span className="text-6xl font-black text-yellow-400 tracking-tight">alt.</span>
          <p className="text-gray-400 mt-2 text-lg">marketing</p>
        </div>
        <p className="text-gray-300 text-center text-lg max-w-sm leading-relaxed">
          Sistema interno de orçamentos e gestão de processos.
        </p>
        <div className="mt-12 flex flex-col gap-3 w-full max-w-xs">
          {["Geração de orçamentos com IA", "Controle de status em tempo real", "Geração de PDFs profissionais"].map((f) => (
            <div key={f} className="flex items-center gap-3 text-gray-400 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Lado direito — formulário */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <div className="lg:hidden text-center mb-2">
            <span className="text-4xl font-black text-gray-900 tracking-tight">alt.</span>
            <p className="text-gray-500 text-sm">marketing</p>
          </div>
          <SignIn />
        </div>
      </div>
    </div>
  );
}
