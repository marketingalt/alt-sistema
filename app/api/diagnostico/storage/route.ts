import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const vars = {
    VERCEL: process.env.VERCEL || "não definido",
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL
      ? process.env.UPSTASH_REDIS_REST_URL.slice(0, 30) + "..." : "não definido",
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN
      ? "definido (" + process.env.UPSTASH_REDIS_REST_TOKEN.length + " chars)" : "não definido",
    KV_REST_API_URL: process.env.KV_REST_API_URL
      ? process.env.KV_REST_API_URL.slice(0, 30) + "..." : "não definido",
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN
      ? "definido (" + process.env.KV_REST_API_TOKEN.length + " chars)" : "não definido",
  };

  const canUseKV =
    (!!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (!!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN);

  // Teste real: tenta ler/write no Upstash (via REST API v2 — comandos no body)
  let testResult = "não testado";
  if (canUseKV) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
      const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const testKey = "_diagnostico_test";
      const testValue = { ok: true, timestamp: Date.now() };

      // Write test: comando SET no body
      const setRes = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(["SET", testKey, JSON.stringify(testValue)]),
      });
      const setJson = await setRes.json();

      // Read test: comando GET no body
      const getRes = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(["GET", testKey]),
        cache: "no-store",
      });
      const getJson = await getRes.json();

      // Cleanup
      await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(["DEL", testKey]),
      });

      if (getJson.result) {
        try {
          const parsed = JSON.parse(getJson.result);
          testResult = parsed.ok
            ? `✅ FUNCIONANDO (SET retornou: ${JSON.stringify(setJson.result)}, GET retornou timestamp: ${parsed.timestamp})`
            : "⚠️ leitura: valor inesperado";
        } catch {
          testResult = `⚠️ leitura: resultado não-JSON - ${String(getJson.result).slice(0, 50)}`;
        }
      } else {
        testResult = `❌ leitura retornou nulo. SET retornou: ${JSON.stringify(setJson)}`;
      }
    } catch (err) {
      testResult = "❌ ERRO: " + (err instanceof Error ? err.message : String(err));
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    ambiente: vars.VERCEL === "1" ? "Vercel (produção)" : "Local (desenvolvimento)",
    storageBackend: canUseKV ? "Upstash Redis ☁️" : "Arquivo local /tmp/data/ 📁",
    variaveis: vars,
    testeUpstash: testResult,
    instrucao: canUseKV
      ? "Upstash configurado. Se o teste acima falhou, verifique se as env vars estão corretas."
      : "Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN no Vercel Dashboard > Settings > Environment Variables",
  });
}
