"use client";

import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import BotaoTopo from "./BotaoTopo";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div id="scroll-container" className="flex-1 min-w-0 overflow-auto">
        <button
          onClick={() => router.back()}
          title="Voltar"
          className="fixed top-4 left-[calc(56px+1rem)] xl:left-[calc(224px+1rem)] z-50 flex items-center justify-center w-9 h-9 rounded-full bg-white border border-gray-200 shadow-sm text-gray-600 hover:text-[#fb4d06] hover:border-[#fb4d06] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {children}
      </div>
      <BotaoTopo />
    </div>
  );
}
