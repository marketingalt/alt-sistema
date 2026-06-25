import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { listarOrcamentos, salvarOrcamento } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const lista = await listarOrcamentos();
  return NextResponse.json(lista, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const user = await currentUser();

  const orcamento = await req.json();
  const salvo = await salvarOrcamento({
    ...orcamento,
    userId: userId || undefined,
    userEmail: user?.emailAddresses[0]?.emailAddress || undefined,
    userName: user?.fullName || user?.firstName || undefined,
  });
  return NextResponse.json(salvo);
}
