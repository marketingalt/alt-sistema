import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
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
  const dados = await ler();

  // Gera parcelas pendentes para contas recorrentes existentes
  let gerou = false;
  const geradas: any[] = [];
  const configs: Record<string, { incremento: number; unidade: "dia" | "mes" | "ano"; total: number }> = {
    mensal:     { incremento: 1, unidade: "mes", total: 12 },
    quinzenal:  { incremento: 15, unidade: "dia", total: 24 },
    semanal:    { incremento: 7, unidade: "dia", total: 52 },
    anual:      { incremento: 1, unidade: "ano", total: 5 },
  };

  for (const conta of dados.contas) {
    if (conta.recorrente && conta.periodicidade && !conta._parcelasGeradas && !conta._parcelaDe) {
      let config: { incremento: number; unidade: "dia" | "mes" | "ano"; total: number } | undefined;

      if (conta.periodicidade === "personalizado") {
        const intervaloValor = parseInt(conta.intervaloValor) || 30;
        const intervaloUnidade = conta.intervaloUnidade || "dia";
        const qtdParcelas = Math.min(parseInt(conta.qtdParcelas) || 12, 120);
        config = { incremento: intervaloValor, unidade: intervaloUnidade, total: qtdParcelas };
      } else {
        config = configs[conta.periodicidade];
      }

      if (!config) continue;

      const dataBase = new Date(conta.dataVencimento + "T12:00:00");
      if (isNaN(dataBase.getTime())) continue;

      // Gera parcelas a partir de i=1 (i=0 já é a conta original)
      for (let i = 1; i < config.total; i++) {
        const dt = new Date(dataBase);
        if (config.unidade === "mes") {
          dt.setMonth(dt.getMonth() + i);
        } else if (config.unidade === "ano") {
          dt.setFullYear(dt.getFullYear() + i);
        } else {
          dt.setDate(dt.getDate() + i * config.incremento);
        }
        geradas.push({
          ...conta,
          id: `${conta.id}_rec${i}`,
          dataVencimento: dt.toISOString().split("T")[0],
          createdAt: new Date().toISOString().split("T")[0],
          _parcelaDe: conta.id,
        });
      }

      conta._parcelasGeradas = true;
      gerou = true;
    }
  }

  if (gerou) {
    dados.contas.push(...geradas);
    await salvar(dados);
  }

  return NextResponse.json(dados);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  const user = await currentUser();
  const dados = await ler();
  const body = await req.json();

  const criarConta = (dataVenc: string, idx: number) => ({
    ...body,
    id: `cp${Date.now()}${idx}`,
    status: "pendente" as const,
    createdAt: new Date().toISOString().split("T")[0],
    dataVencimento: dataVenc,
    _parcelasGeradas: true,
    userId: userId || undefined,
    userName: user?.fullName || user?.firstName || undefined,
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

    let config: RecurrenceConfig;

    if (body.periodicidade === "personalizado") {
      // Valida campos personalizados
      const intervaloValor = parseInt(body.intervaloValor) || 30;
      const intervaloUnidade = body.intervaloUnidade || "dia";
      const qtdParcelas = Math.min(parseInt(body.qtdParcelas) || 12, 120);
      config = {
        incremento: intervaloValor,
        unidade: intervaloUnidade as "dia" | "mes" | "ano",
        total: qtdParcelas,
      };
    } else {
      config = configs[body.periodicidade];
      if (!config) {
        return NextResponse.json({ error: "Periodicidade inválida" }, { status: 400 });
      }
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
