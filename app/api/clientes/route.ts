import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { listarClientes, salvarCliente } from "@/lib/storage";
import { clerkClient } from "@clerk/nextjs/server";

async function userFinanceiro(userId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    if (user.publicMetadata?.role === "admin") return true;
    const permissoes = (user.publicMetadata?.permissoes as string[]) || [];
    return permissoes.includes("financeiro");
  } catch { return false; }
}

export async function GET() {
  const { userId } = await auth.protect();
  const [todos, isFinanceiro] = await Promise.all([listarClientes(), userFinanceiro(userId)]);
  if (!isFinanceiro) {
    return NextResponse.json(todos.filter((c: any) => !c.restritoFinanceiro));
  }
  return NextResponse.json(todos);
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
