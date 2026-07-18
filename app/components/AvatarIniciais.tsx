"use client";

const CORES = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-pink-500",
];

function hashNome(nome: string): number {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface Props {
  nome: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function AvatarIniciais({ nome, size = "sm", className = "" }: Props) {
  const cor = CORES[hashNome(nome) % CORES.length];
  const tamanho = size === "lg" ? "w-9 h-9 text-xs" : size === "md" ? "w-7 h-7 text-[10px]" : "w-5 h-5 text-[8px]";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 ${cor} ${tamanho} ${className}`}
      title={nome}
    >
      {iniciais(nome)}
    </span>
  );
}
