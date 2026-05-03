import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const DOMINIO_PERMITIDO = "@altmkt.com.br";
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/acesso-negado"]);

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
      return NextResponse.redirect(new URL("/acesso-negado", req.url));
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
