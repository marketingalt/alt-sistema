import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/storage-adapter";

interface ContasPagarDB {
  contas: any[];
}

async function ler(): Promise<ContasPagarDB> {
  return dbGet<ContasPagarDB>("contas-a-pagar", { contas: [] });
}
async function salvar(d: ContasPagarDB) {
  await dbSet("contas-a-pagar", d);
}

export async function GET() {
  return NextResponse.json(await ler());
}

export async function POST(req: Request) {
  const dados = await ler();
  const body = await req.json();
  const nova = {
    ...body,
    id: `cp${Date.now()}`,
    status: "pendente",
    createdAt: new Date().toISOString().split("T")[0],
  };
  dados.contas.push(nova);
  await salvar(dados);
  return NextResponse.json(nova, { status: 201 });
}
