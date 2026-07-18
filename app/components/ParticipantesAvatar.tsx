"use client";

import AvatarIniciais from "./AvatarIniciais";

interface Props {
  participantes?: { userId: string; nome: string }[] | null;
  max?: number;
  size?: "sm" | "md";
}

export default function ParticipantesAvatar({ participantes, max = 3, size = "sm" }: Props) {
  if (!participantes || participantes.length === 0) return <span className="text-gray-300 text-xs">—</span>;

  const visiveis = participantes.slice(0, max);
  const restantes = participantes.length - max;

  return (
    <div className="flex items-center">
      <div className="flex">
        {visiveis.map((p, idx) => (
          <div
            key={p.userId}
            className="ring-2 ring-white"
            style={{ marginLeft: idx === 0 ? 0 : -4, zIndex: visiveis.length - idx }}
          >
            <AvatarIniciais nome={p.nome} size={size} />
          </div>
        ))}
      </div>
      {restantes > 0 && (
        <span className="text-[10px] text-gray-400 font-medium ml-1">+{restantes}</span>
      )}
    </div>
  );
}
