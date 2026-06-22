import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { listarClientes, salvarCliente } from "@/lib/storage";

export async function GET() {
  return NextResponse.json(await listarClientes());
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const user = await currentUser();
  const body = await req.json();
  const salvo = await salvarCliente({
    ...body,
    userId: userId || undefined,
    userName: user?.fullName || user?.firstName || undefined,
  });
  return NextResponse.json(salvo);
}
