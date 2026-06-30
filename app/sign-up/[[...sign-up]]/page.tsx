import { SignUp } from "@clerk/nextjs";
import SistemaLogo from "@/app/components/SistemaLogo";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-black flex-col items-center justify-center px-12">
        <div className="mb-10 text-center">
          <div className="mb-6">
            <SistemaLogo
              width={220}
              height={60}
              className="mx-auto object-contain"
            />
          </div>
          <p className="text-gray-300 text-center text-lg max-w-sm leading-relaxed">
            Crie sua conta para acessar a plataforma Omni Alt.
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <div className="lg:hidden text-center mb-2">
            <SistemaLogo
              width={150}
              height={40}
              className="mx-auto object-contain"
            />
          </div>
          <SignUp />
        </div>
      </div>
    </div>
  );
}
