import { NextRequest, NextResponse } from "next/server";
import { listarOrdensServico, salvarOrdemServico } from "@/lib/storage";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET() {
  const lista = await listarOrdensServico();
  return NextResponse.json(lista, { headers: NO_CACHE_HEADERS });
}
