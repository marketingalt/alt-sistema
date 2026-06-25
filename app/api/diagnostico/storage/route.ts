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

  // Teste real: tenta ler/write no Upstash
  let testResult = "não testado";
  if (canUseKV) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
      const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

      // Write test
      const testKey = "_diagnostico_test";
      await fetch(`${url}/set/${testKey}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ok: true, timestamp: Date.now() }),
      });

      // Read test
      const readRes = await fetch(`${url}/get/${testKey}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const readJson = await readRes.json();

      // Cleanup
      await fetch(`${url}/del/${testKey}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (readJson.result) {
        const parsed = JSON.parse(readJson.result);
        testResult = parsed.ok ? "✅ FUNCIONANDO" : "⚠️ leitura falhou";
      } else {
        testResult = "❌ leitura retornou nulo";
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
