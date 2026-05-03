import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { listarFornecedores, salvarFornecedor } from "@/lib/storage";

export async function GET() {
  return NextResponse.json(listarFornecedores());
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const user = await currentUser();
  const body = await req.json();
  const salvo = salvarFornecedor({
    ...body,
    userId: userId || undefined,
    userName: user?.fullName || user?.firstName || undefined,
  });
  return NextResponse.json(salvo);
}
