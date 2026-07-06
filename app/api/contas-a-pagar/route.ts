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

  const criarConta = (dataVenc: string, idx: number) => ({
    ...body,
    id: `cp${Date.now()}${idx}`,
    status: "pendente" as const,
    createdAt: new Date().toISOString().split("T")[0],
    dataVencimento: dataVenc,
  });

  if (body.recorrente && body.periodicidade) {
    const dataBase = new Date(body.dataVencimento + "T12:00:00");
    if (isNaN(dataBase.getTime())) {
      return NextResponse.json({ error: "Data de vencimento inválida" }, { status: 400 });
    }

    interface RecurrenceConfig {
      incremento: number;
      unidade: "dia" | "mes" | "ano";
      total: number;
    }
    const configs: Record<string, RecurrenceConfig> = {
      mensal:     { incremento: 1, unidade: "mes", total: 12 },
      quinzenal:  { incremento: 15, unidade: "dia", total: 24 },
      semanal:    { incremento: 7, unidade: "dia", total: 52 },
      anual:      { incremento: 1, unidade: "ano", total: 5 },
    };
    const config = configs[body.periodicidade];
    if (!config) {
      return NextResponse.json({ error: "Periodicidade inválida" }, { status: 400 });
    }

    const contas: any[] = [];
    for (let i = 0; i < config.total; i++) {
      const dt = new Date(dataBase);
      if (config.unidade === "mes") {
        dt.setMonth(dt.getMonth() + i);
      } else if (config.unidade === "ano") {
        dt.setFullYear(dt.getFullYear() + i);
      } else {
        dt.setDate(dt.getDate() + i * config.incremento);
      }
      contas.push(criarConta(dt.toISOString().split("T")[0], i));
    }

    dados.contas.push(...contas);
    await salvar(dados);
    return NextResponse.json({ contas, criadas: contas.length }, { status: 201 });
  }

  // Conta avulsa (não recorrente)
  const nova = criarConta(body.dataVencimento, 0);
  dados.contas.push(nova);
  await salvar(dados);
  return NextResponse.json({ contas: [nova], criadas: 1 }, { status: 201 });
}
