"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

interface Vendedor {
  id: string;
  nome: string;
  ativo?: boolean;
}

interface Props {
  value?: string;
  onChange: (id: string) => void;
}

export default function CampoVendedor({ value, onChange }: Props) {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);

  useEffect(() => {
    apiFetch("/api/financeiro/vendas-comissoes/vendedores")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: Vendedor[]) => setVendedores(lista))
      .catch(() => {});
  }, []);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1.5">Vendedor responsável</label>
      <select
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#fb4d06]/30 bg-white"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {vendedores
          .filter((v) => v.ativo !== false)
          .map((v) => (
            <option key={v.id} value={v.id}>
              {v.nome}
            </option>
          ))}
      </select>
    </div>
  );
}
