"use client";

import { useRef, useState } from "react";
import Image from "next/image";

export async function comprimirImagem(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX_W = 600;
        const MAX_H = 400;
        let w = img.width;
        let h = img.height;
        if (w > MAX_W || h > MAX_H) {
          const ratio = Math.min(MAX_W / w, MAX_H / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface Props {
  valor?: string;
  onChange: (v: string | undefined) => void;
  label?: string;
  width?: number;
  height?: number;
}

export default function ImagemReferencia({
  valor,
  onChange,
  label = "Imagem de referência",
  width = 100,
  height = 72,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  async function processar(file: File) {
    if (!file.type.startsWith("image/")) return;
    const base64 = await comprimirImagem(file);
    onChange(base64);
  }

  return (
    <div className="shrink-0">
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processar(f); }}
      />
      {valor ? (
        <div
          className="relative rounded-lg overflow-hidden border border-gray-200 group cursor-pointer"
          style={{ width, height }}
          onClick={() => inputRef.current?.click()}
        >
          <Image src={valor} alt="Referência" fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
            <span className="text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition">Trocar</span>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(undefined); }}
            className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/50 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-[10px]"
          >✕</button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            const f = e.dataTransfer.files?.[0];
            if (f) processar(f);
          }}
          style={{ width, height }}
          className={`rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition gap-1 ${
            arrastando ? "border-[#fb4d06]/60 bg-[#fb4d06]/5" : "border-gray-200 hover:border-[#fb4d06]/40 hover:bg-gray-50"
          }`}
        >
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
          </svg>
          <span className="text-[10px] text-gray-400 text-center leading-tight px-1">Arraste ou clique</span>
        </div>
      )}
    </div>
  );
}
