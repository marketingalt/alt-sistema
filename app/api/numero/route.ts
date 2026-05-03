import { NextResponse } from "next/server";
import { gerarNumeroOrcamento } from "@/lib/storage";

export async function GET() {
  const numero = gerarNumeroOrcamento();
  return NextResponse.json({ numero });
}
