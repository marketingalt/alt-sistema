import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { listarProdutos, salvarProduto } from "@/lib/storage";

export async function GET() {
  return NextResponse.json(await listarProdutos());
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const user = await currentUser();
  const body = await req.json();
  const salvo = await salvarProduto({
    ...body,
    userId: userId || undefined,
    userName: user?.fullName || user?.firstName || undefined,
  });
  return NextResponse.json(salvo);
}
