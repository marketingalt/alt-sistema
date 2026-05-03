"use client";

export default function BotaoTopo() {
  function voltarTopo() {
    document.getElementById("scroll-container")?.scrollTo({ top: 0, behavior: "smooth" });
    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <button
      onClick={voltarTopo}
      aria-label="Voltar ao topo"
      className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full border border-gray-200 bg-white text-gray-400 hover:bg-[#fb4d06] hover:border-[#fb4d06] hover:text-white shadow-sm transition-all flex items-center justify-center"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
