"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-fetch";

interface SistemaLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export default function SistemaLogo({ className, width = 180, height = 50 }: SistemaLogoProps) {
  const [src, setSrc] = useState<string>("/logo.png");

  useEffect(() => {
    apiFetch("/api/admin/logo")
      .then((r) => r.json())
      .then((data) => {
        if (data.logoBase64) setSrc(data.logoBase64);
      })
      .catch(() => {});
  }, []);

  return (
    <img
      src={src}
      alt="Omni Alt"
      width={width}
      height={height}
      className={className}
    />
  );
}
