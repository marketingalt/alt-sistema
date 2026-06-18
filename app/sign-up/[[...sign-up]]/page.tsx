import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-black flex-col items-center justify-center px-12">
        <div className="mb-10 text-center">
          <div className="mb-6">
            <span className="text-5xl font-bold text-[#fb4d06] tracking-tight">Omini</span>
            <span className="text-5xl font-bold text-[#fb4d06] tracking-tight ml-2">Alt</span>
          </div>
          <p className="text-gray-300 text-center text-lg max-w-sm leading-relaxed">
            Crie sua conta para acessar a plataforma Omini Alt.
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <div className="lg:hidden text-center mb-2">
            <span className="text-3xl font-bold text-[#fb4d06] tracking-tight">Omini</span>
            <span className="text-3xl font-bold text-[#fb4d06] tracking-tight ml-1.5">Alt</span>
          </div>
          <SignUp />
        </div>
      </div>
    </div>
  );
}
