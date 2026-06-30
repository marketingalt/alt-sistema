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
        <div className="sticky top-0 z-50 flex items-center px-4 py-1.5 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">
          <button
            onClick={() => router.back()}
            title="Voltar"
            className="flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-[#fb4d06] hover:bg-gray-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        {children}
      </div>
      <BotaoTopo />
    </div>
  );
}
