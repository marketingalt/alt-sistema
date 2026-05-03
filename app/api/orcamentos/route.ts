import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { listarOrcamentos, salvarOrcamento } from "@/lib/storage";

export async function GET() {
  const lista = listarOrcamentos();
  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const user = await currentUser();

  const orcamento = await req.json();
  const salvo = salvarOrcamento({
    ...orcamento,
    userId: userId || undefined,
    userEmail: user?.emailAddresses[0]?.emailAddress || undefined,
    userName: user?.fullName || user?.firstName || undefined,
  });
  return NextResponse.json(salvo);
}
