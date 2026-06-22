import { NextResponse } from "next/server";
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
  const body = await req.json();
  const dados = await ler();
  const novo = {
    ...body,
    id: `fat${Date.now()}`,
    tipo: "manual",
    createdAt: new Date().toISOString().split("T")[0],
  };
  dados.registros.push(novo);
  await salvar(dados);
  return NextResponse.json(novo, { status: 201 });
}
