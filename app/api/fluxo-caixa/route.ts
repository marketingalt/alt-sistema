import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "fluxo-caixa.json");

function ler() {
  return JSON.parse(fs.readFileSync(FILE, "utf-8"));
}
function salvar(dados: unknown) {
  fs.writeFileSync(FILE, JSON.stringify(dados, null, 2), "utf-8");
}

export async function GET() {
  return NextResponse.json(ler());
}

export async function POST(req: Request) {
  const dados = ler();
  const body = await req.json();
  const novo = {
    ...body,
    id: `fc${Date.now()}`,
    createdAt: new Date().toISOString().split("T")[0],
  };
  dados.lancamentos.push(novo);
  salvar(dados);
  return NextResponse.json(novo, { status: 201 });
}

export async function PUT(req: Request) {
  const dados = ler();
  const body = await req.json();
  if (body.saldoInicial !== undefined) {
    dados.saldoInicial = body.saldoInicial;
    dados.saldoInicialData = body.saldoInicialData;
    salvar(dados);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nenhum campo válido" }, { status: 400 });
}
