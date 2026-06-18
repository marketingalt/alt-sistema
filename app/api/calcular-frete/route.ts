import { NextRequest, NextResponse } from "next/server";

const TAXA_KM = 1.5;
const FATOR_OPERACIONAL = 1.1;

interface Coord {
  lat: number;
  lon: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocode(address: string): Promise<Coord | null> {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=br`;
  const res = await fetch(url, {
    headers: { "User-Agent": "alt-orcamentos/1.0 (thiemy@altmkt.com.br)" },
  });
  const data = await res.json();
  if (!data[0]) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

export async function POST(req: NextRequest) {
  const { origem, destinos } = (await req.json()) as {
    origem: string;
    destinos: string[];
  };

  if (!origem?.trim() || !destinos?.length) {
    return NextResponse.json(
      { error: "Origem e destinos são obrigatórios" },
      { status: 400 }
    );
  }

  // Geocode all addresses sequentially (Nominatim: máx 1 req/s)
  const todoEnderecos = [origem, ...destinos];
  const coords: (Coord | null)[] = [];

  for (let i = 0; i < todoEnderecos.length; i++) {
    if (i > 0) await sleep(1100);
    coords.push(await geocode(todoEnderecos[i]));
  }

  const coordOrigem = coords[0];
  if (!coordOrigem) {
    return NextResponse.json(
      { error: "Endereço de origem não encontrado. Tente um endereço mais completo." },
      { status: 400 }
    );
  }

  // Montar waypoints válidos para o OSRM Table API
  // Índice 0 = origem; demais = destinos
  const pontosValidos: { originalIdx: number; coord: Coord }[] = [
    { originalIdx: 0, coord: coordOrigem },
  ];
  for (let i = 1; i < coords.length; i++) {
    if (coords[i]) pontosValidos.push({ originalIdx: i, coord: coords[i]! });
  }

  // distâncias em metros por destino (null = falhou)
  const distanciasPorDestino: (number | null)[] = new Array(destinos.length).fill(null);

  if (pontosValidos.length > 1) {
    const waypointsStr = pontosValidos
      .map((p) => `${p.coord.lon},${p.coord.lat}`)
      .join(";");

    try {
      const osrmRes = await fetch(
        `http://router.project-osrm.org/table/v1/driving/${waypointsStr}?sources=0&annotations=distance`,
        { headers: { "User-Agent": "alt-orcamentos/1.0" } }
      );
      const osrmData = await osrmRes.json();

      if (osrmData.code === "Ok") {
        const dists: (number | null)[] = osrmData.distances[0];
        pontosValidos.forEach((p, pontoIdx) => {
          if (pontoIdx === 0) return;
          const destinoIdx = p.originalIdx - 1;
          distanciasPorDestino[destinoIdx] = dists[pontoIdx] ?? null;
        });
      }
    } catch {
      // OSRM indisponível — retorna erro genérico
    }
  }

  const resultados = destinos.map((destino, i) => {
    const distM = distanciasPorDestino[i];
    if (!coords[i + 1] || distM === null || distM === 0) {
      return { destino, erro: true, km: 0, custo: 0, distanciaTexto: "" };
    }
    const km = distM / 1000;
    const custo = km * TAXA_KM * FATOR_OPERACIONAL;
    const distanciaTexto = km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(distM)} m`;
    return {
      destino,
      erro: false,
      km: parseFloat(km.toFixed(1)),
      distanciaTexto,
      custo: parseFloat(custo.toFixed(2)),
    };
  });

  return NextResponse.json({ resultados });
}
