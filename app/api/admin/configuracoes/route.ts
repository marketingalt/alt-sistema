import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkIsAdmin, getSystemSettings, saveSystemSettings } from "@/lib/admin";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
    }

    const settings = getSystemSettings();
    return NextResponse.json(settings);
  } catch (err) {
    console.error("Erro ao buscar configurações:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
    }

    const body = await req.json();
    const saved = saveSystemSettings(body);
    return NextResponse.json(saved);
  } catch (err) {
    console.error("Erro ao salvar configurações:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
