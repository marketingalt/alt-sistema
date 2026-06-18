import WorkspaceLayout from "@/app/components/WorkspaceLayout";

export default function ProvisionamentoPage() {
  return (
    <WorkspaceLayout>
      <main className="px-8 py-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Provisionamento</h1>
          <p className="text-gray-500 text-sm mt-1">Planeje e provisione receitas e despesas futuras.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#fb4d06]/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-[#fb4d06]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-700">Em construção</p>
            <p className="text-sm text-gray-400 mt-1">Esta seção está sendo desenvolvida.</p>
          </div>
        </div>
      </main>
    </WorkspaceLayout>
  );
}
