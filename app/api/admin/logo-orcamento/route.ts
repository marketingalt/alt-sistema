import { NextRequest, NextResponse } from "next/server";
import { getSystemSettings, saveSystemSettings } from "@/lib/admin";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const settings = await getSystemSettings();
    return NextResponse.json({ logoBase64: settings.logoOrcamentoPadrao || null });
  } catch {
    return NextResponse.json({ error: "Erro ao carregar logo" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { logoBase64 } = await req.json();
    if (!logoBase64 || typeof logoBase64 !== "string") {
      return NextResponse.json({ error: "Envie logoBase64 (base64 da imagem)" }, { status: 400 });
    }

    const settings = await getSystemSettings();
    settings.logoOrcamentoPadrao = logoBase64;
    await saveSystemSettings(settings);

    return NextResponse.json({ success: true, logoBase64 });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar logo" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const settings = await getSystemSettings();
    delete settings.logoOrcamentoPadrao;
    await saveSystemSettings(settings);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao remover logo" }, { status: 500 });
  }
}
