import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex">
      {/* Lado esquerdo — branding */}
      <div className="hidden lg:flex w-1/2 bg-black flex-col items-center justify-center px-12">
        <div className="mb-10 text-center">
          <div className="mb-6">
            <span className="text-5xl font-bold text-[#fb4d06] tracking-tight">Omni</span>
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
            <span className="text-3xl font-bold text-[#fb4d06] tracking-tight">Omni</span>
            <span className="text-3xl font-bold text-[#fb4d06] tracking-tight ml-1.5">Alt</span>
          </div>
          <SignIn />
        </div>
      </div>
    </div>
  );
}
