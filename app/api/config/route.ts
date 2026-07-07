import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSystemSettings, saveSystemSettings } from "@/lib/admin";

export async function GET() {
  const { userId } = await auth.protect();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const settings = await getSystemSettings();
    const bancos = settings.bancos?.length ? settings.bancos : ["C6 BANK", "Banco Itaú"];
    const categorias = settings.categorias?.length ? settings.categorias : [
      "RECEITA OPERACIONAL BRUTA",
      "CUSTOS DIRETOS DOS SERVIÇOS",
      "DESPESAS ADM E GERAIS",
      "DESPESAS COM PESSOAL OPERACIONAL",
      "DESPESAS COM PESSOAL — PROLABORE",
      "DEDUÇÕES DA RECEITA (IMPOSTOS)",
      "DESPESAS COMERCIAIS",
      "RESULTADO FINANCEIRO",
      "EMPRÉSTIMO THIEMY",
      "EMPRÉSTIMO FERNANDO",
      "DEVOLUÇÃO THIEMY",
      "DEVOLUÇÃO FERNANDO",
      "ESTORNO",
    ];
    return NextResponse.json({ bancos, categorias });
  } catch {
    return NextResponse.json({
      bancos: ["C6 BANK", "Banco Itaú"],
      categorias: ["RECEITA OPERACIONAL BRUTA", "CUSTOS DIRETOS DOS SERVIÇOS", "DESPESAS ADM E GERAIS"],
    });
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

    if (body.categorias) {
      settings.categorias = body.categorias;
    }
    if (body.bancos) {
      settings.bancos = body.bancos;
    }

    await saveSystemSettings(settings);
    return NextResponse.json({ ok: true, categorias: settings.categorias, bancos: settings.bancos });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar configurações" }, { status: 500 });
  }
}
