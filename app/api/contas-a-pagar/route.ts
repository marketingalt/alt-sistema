import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "contas-a-pagar.json");

function ler() { return JSON.parse(fs.readFileSync(FILE, "utf-8")); }
function salvar(d: unknown) { fs.writeFileSync(FILE, JSON.stringify(d, null, 2), "utf-8"); }

export async function GET() {
  return NextResponse.json(ler());
}

export async function POST(req: Request) {
  const dados = ler();
  const body = await req.json();
  const nova = {
    ...body,
    id: `cp${Date.now()}`,
    status: "pendente",
    createdAt: new Date().toISOString().split("T")[0],
  };
  dados.contas.push(nova);
  salvar(dados);
  return NextResponse.json(nova, { status: 201 });
}
