"use client";

interface ProjetoTag {
  id: string;
  nome: string;
  cor: string;
}

interface Props {
  projetos: ProjetoTag[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function TagSelector({ projetos, selected, onChange }: Props) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {projetos.map((p) => {
        const ativo = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              ativo
                ? "border-transparent text-white shadow-sm"
                : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
            }`}
            style={
              ativo
                ? { backgroundColor: p.cor, boxShadow: `0 0 8px ${p.cor}55` }
                : undefined
            }
          >
            {/* Bolinha indicadora */}
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                ativo ? "bg-white/70" : ""
              }`}
              style={!ativo ? { backgroundColor: p.cor } : undefined}
            />
            {p.nome}
            {ativo && (
              <svg className="w-3 h-3 shrink-0 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        );
      })}
      {projetos.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          Nenhum projeto encontrado. Crie um projeto em Planejamento primeiro.
        </p>
      )}
    </div>
  );
}
