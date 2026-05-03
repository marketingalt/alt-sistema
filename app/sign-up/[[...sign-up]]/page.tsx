import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-gray-900 via-gray-900 to-purple-900 flex-col items-center justify-center px-12">
        <div className="mb-8">
          <span className="text-6xl font-black text-yellow-400 tracking-tight">alt.</span>
          <p className="text-gray-400 mt-2 text-lg">marketing</p>
        </div>
        <p className="text-gray-300 text-center text-lg max-w-sm leading-relaxed">
          Crie sua conta para acessar o workspace da Alt Marketing.
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <div className="lg:hidden text-center mb-2">
            <span className="text-4xl font-black text-gray-900 tracking-tight">alt.</span>
            <p className="text-gray-500 text-sm">marketing</p>
          </div>
          <SignUp />
        </div>
      </div>
    </div>
  );
}
