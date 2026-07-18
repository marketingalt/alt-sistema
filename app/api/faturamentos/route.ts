import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";

interface FaturamentosDB {
  registros: any[];
}

async function ler(): Promise<FaturamentosDB> {
  return dbGet<FaturamentosDB>("faturamentos", { registros: [] });
}
async function salvar(d: FaturamentosDB) {
  await dbSet("faturamentos", d);
}

export async function GET() {
  return NextResponse.json(await ler());
}

export async function POST(req: Request) {
  const { userId } = await auth();
  const user = await currentUser();
  const body = await req.json();
  const dados = await ler();
  const novo = {
    ...body,
    id: `fat${Date.now()}`,
    tipo: "manual",
    createdAt: new Date().toISOString().split("T")[0],
    userId: userId || undefined,
    userName: user?.fullName || user?.firstName || undefined,
  };
  dados.registros.push(novo);
  await salvar(dados);
  return NextResponse.json(novo, { status: 201 });
}
