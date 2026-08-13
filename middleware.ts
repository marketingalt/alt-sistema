import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { BASE_PATH } from "./lib/base-path";

const DOMINIO_PERMITIDO = "@altmkt.com.br";
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/acesso-negado",
  "/boas-vindas",
  "/p/vendedor(.*)",
  "/api/xbz/cron(.*)",
  "/api/fluxo-caixa/importar-planilha(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId } = await auth.protect();

  if (userId) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    const emailPrincipal = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    )?.emailAddress || "";

    const temDominio = user.emailAddresses.some((e) =>
      e.emailAddress.endsWith(DOMINIO_PERMITIDO)
    );

    if (!temDominio) {
      console.log(`Acesso negado: ${emailPrincipal}`);
      const url = req.nextUrl.clone();
      url.pathname = `${BASE_PATH}/acesso-negado`;
      return NextResponse.redirect(url);
    }

    // ── Onboarding ─────────────────────────────────────
    // Verifica pelo metadata do Clerk OU por cookie como fallback
    const onboarding = user.publicMetadata?.onboarding;
    const onboardingCookie = req.cookies.get("onboarding_complete")?.value === "true";

    // Se já tem role/permissões definidas (admin já configurou), considera onboarding completo
    const temRole = user.publicMetadata?.role === "admin" || user.publicMetadata?.role === "user";
    const temPermissoes = Array.isArray(user.publicMetadata?.permissoes) && user.publicMetadata!.permissoes!.length > 0;
    const temNomeExibicao = typeof user.publicMetadata?.nomeExibicao === "string" && user.publicMetadata.nomeExibicao.trim().length > 0;

    if (
      !onboarding &&
      !onboardingCookie &&
      !temRole &&
      !temPermissoes &&
      !temNomeExibicao &&
      !req.nextUrl.pathname.startsWith("/api/") &&
      !req.nextUrl.pathname.startsWith("/_next")
    ) {
      const url = req.nextUrl.clone();
      url.pathname = `${BASE_PATH}/boas-vindas`;
      return NextResponse.redirect(url);
    }
  }
}, { signInUrl: "/sign-in" });

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
