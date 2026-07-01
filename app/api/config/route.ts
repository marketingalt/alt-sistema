import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/admin";

export async function GET() {
  const { userId } = await auth.protect();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const settings = await getSystemSettings();
    const bancos = settings.bancos?.length ? settings.bancos : ["C6 BANK", "Banco Itaú"];
    return NextResponse.json({ bancos });
  } catch {
    return NextResponse.json({ bancos: ["C6 BANK", "Banco Itaú"] });
  }
}
