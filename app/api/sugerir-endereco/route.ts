import { NextRequest, NextResponse } from "next/server";

interface NominatimItem {
  place_id: number;
  display_name: string;
  address?: Record<string, string>;
}

function formatarEndereco(item: NominatimItem): string {
  const partes = item.display_name
    .split(",")
    .map((s) => s.trim())
    .filter(
      (p) =>
        p !== "Brasil" &&
        !p.toLowerCase().includes("região") &&
        !p.toLowerCase().includes("microrregião") &&
        !p.toLowerCase().includes("mesorregião")
    );
  return partes.slice(0, 5).join(", ");
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.length < 3) return NextResponse.json({ sugestoes: [] });

  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(q)}` +
    `&format=json&limit=6&countrycodes=br&addressdetails=1`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "alt-orcamentos/1.0 (thiemy@altmkt.com.br)",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    const data: NominatimItem[] = await res.json();

    const sugestoes = data.map((item) => ({
      texto: item.display_name,
      display: formatarEndereco(item),
      placeId: String(item.place_id),
    }));

    return NextResponse.json({ sugestoes });
  } catch {
    return NextResponse.json({ sugestoes: [] });
  }
}
