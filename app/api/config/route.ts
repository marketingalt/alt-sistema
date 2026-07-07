import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSystemSettings, saveSystemSettings } from "@/lib/admin";

const FALLBACK_BANCOS = ["C6 BANK", "Banco Itaú"];
const FALLBACK_CATEGORIAS = [
  "RECEITA OPERACIONAL BRUTA", "CUSTOS DIRETOS DOS SERVIÇOS", "DESPESAS ADM E GERAIS",
  "DESPESAS COM PESSOAL OPERACIONAL", "DESPESAS COM PESSOAL — PROLABORE",
  "DEDUÇÕES DA RECEITA (IMPOSTOS)", "DESPESAS COMERCIAIS", "RESULTADO FINANCEIRO",
  "EMPRÉSTIMO THIEMY", "EMPRÉSTIMO FERNANDO", "DEVOLUÇÃO THIEMY", "DEVOLUÇÃO FERNANDO", "ESTORNO",
];
const FALLBACK_AREAS = ["PROJETOS", "DIGITAL", "MISTO", "ESTORNO"];

export async function GET() {
  const { userId } = await auth.protect();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const settings = await getSystemSettings();
    return NextResponse.json({
      bancos: settings.bancos?.length ? settings.bancos : FALLBACK_BANCOS,
      categorias: settings.categorias?.length ? settings.categorias : FALLBACK_CATEGORIAS,
      areas: settings.areas?.length ? settings.areas : FALLBACK_AREAS,
    });
  } catch {
    return NextResponse.json({ bancos: FALLBACK_BANCOS, categorias: FALLBACK_CATEGORIAS, areas: FALLBACK_AREAS });
  }
}

export async function PUT(req: Request) {
  const { userId } = await auth.protect();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const settings = await getSystemSettings();

    if (body.categorias) settings.categorias = body.categorias;
    if (body.bancos) settings.bancos = body.bancos;
    if (body.areas) settings.areas = body.areas;

    await saveSystemSettings(settings);
    return NextResponse.json({
      ok: true,
      categorias: settings.categorias,
      bancos: settings.bancos,
      areas: settings.areas,
    });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar configurações" }, { status: 500 });
  }
}
