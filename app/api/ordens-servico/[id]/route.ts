import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { buscarOrdemServico, salvarOrdemServico, deletarOrdemServico } from "@/lib/storage";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const os = await buscarOrdemServico(id);
  if (!os) return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });
  return NextResponse.json(os, { headers: NO_CACHE_HEADERS });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const os = await buscarOrdemServico(id);
    if (!os) return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });

    const patch = await req.json();
    const { userId } = await auth();
    const user = await currentUser();
    const atualizada: any = {
      ...os,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
      updatedById: userId || undefined,
      updatedBy: user?.fullName || user?.firstName || undefined,
    };
    const salva = await salvarOrdemServico(atualizada);
    return NextResponse.json(salva, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erro ao atualizar OS: ${msg}` }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const os = await buscarOrdemServico(id);
    if (!os) return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });
    await deletarOrdemServico(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erro ao deletar OS: ${msg}` }, { status: 500 });
  }
}
