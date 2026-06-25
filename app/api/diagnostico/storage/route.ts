import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const vars = {
    VERCEL: process.env.VERCEL || "não definido",
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL
      ? process.env.UPSTASH_REDIS_REST_URL.slice(0, 40) + "..." : "não definido",
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN
      ? "definido (" + process.env.UPSTASH_REDIS_REST_TOKEN.length + " chars)" : "não definido",
    KV_REST_API_URL: process.env.KV_REST_API_URL
      ? process.env.KV_REST_API_URL.slice(0, 40) + "..." : "não definido",
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN
      ? "definido (" + process.env.KV_REST_API_TOKEN.length + " chars)" : "não definido",
  };

  const canUseKV =
    (!!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (!!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN);

  let testResult = "não testado";
  if (canUseKV) {
    try {
      const { Redis } = await import("@upstash/redis");

      const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
      const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

      console.log(`[DIAG] Criando cliente Redis com url=${url.slice(0, 30)}... token len=${token.length}`);

      const redis = new Redis({ url, token });

      // Testa PING primeiro
      const pong = await redis.ping();
      console.log(`[DIAG] PING retornou:`, pong);

      // Testa SET
      const setResult = await redis.set("_diag_test", { ok: true, ts: Date.now() });
      console.log(`[DIAG] SET retornou:`, setResult);

      // Testa GET
      const getResult = await redis.get<{ ok: boolean; ts: number }>("_diag_test");
      console.log(`[DIAG] GET retornou:`, getResult);

      // Cleanup
      await redis.del("_diag_test");

      if (getResult?.ok) {
        testResult = `✅ FUNCIONANDO (PING: ${pong}, GET: ok=true)`;
      } else {
        testResult = `⚠️ SET funcionou mas GET retornou: ${JSON.stringify(getResult)}`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack?.slice(0, 300) : "";
      console.error("[DIAG ERROR]", msg, stack);
      testResult = `❌ ERRO: ${msg}`;
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    ambiente: vars.VERCEL === "1" ? "Vercel (produção)" : "Local (desenvolvimento)",
    storageBackend: canUseKV ? "Upstash Redis ☁️" : "Arquivo local /tmp/data/ 📁",
    variaveis: vars,
    testeUpstash: testResult,
  });
}
