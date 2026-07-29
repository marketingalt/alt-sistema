"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { parseBrl } from "@/lib/parseBrl";

/**
 * Campo de texto para valores monetários em formato brasileiro (vírgula decimal,
 * ponto de milhar). Substitui <input type="number"> nesses casos porque o Chromium
 * (e derivados) nunca aceita vírgula como separador decimal em type="number" —
 * o dígito digitado depois da vírgula simplesmente gruda no anterior
 * (ex: "98,90" digitado vira 9890).
 */

function formatarParaEdicao(valor: number | undefined): string {
  if (!valor) return "";
  return valor.toString().replace(".", ",");
}

interface CampoMoedaProps {
  value: number | undefined;
  onChange: (valor: number) => void;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  title?: string;
  id?: string;
}

export default function CampoMoeda({ value, onChange, className, style, placeholder, disabled, required, title, id }: CampoMoedaProps) {
  const [texto, setTexto] = useState(() => formatarParaEdicao(value));
  const focado = useRef(false);

  useEffect(() => {
    if (!focado.current) setTexto(formatarParaEdicao(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      id={id}
      title={title}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      className={className}
      style={style}
      value={texto}
      onFocus={() => { focado.current = true; }}
      onBlur={() => {
        focado.current = false;
        setTexto(formatarParaEdicao(value));
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setTexto(raw);
        onChange(parseBrl(raw));
      }}
    />
  );
}
