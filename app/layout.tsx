import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import Script from "next/script";

// Toda página aqui é protegida por auth.protect() no middleware. Sem isso,
// páginas sem chamada dinâmica no servidor (a busca de dados é client-side)
// eram tratadas como estáticas pelo Next — o HTML era cacheado com
// s-maxage de 1 ano e servido direto em requests seguintes, sem checar
// sessão de novo. Daí o "abre a home, só depois vai pro login".
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Omni Alt",
  description: "Sistema interno de gestão — Omni Alt",
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "Omni Alt",
    description: "Sistema interno de gestão — Omni Alt",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={ptBR}>
      <html lang="pt-BR" className="h-full">
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function() {
              try {
                var theme = localStorage.getItem("alt_theme");
                if (theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
                  document.documentElement.classList.add("dark");
                }
              } catch(e) {}
            })();
          `}
        </Script>
        <body className="min-h-full flex flex-col bg-[var(--background)]">{children}</body>
      </html>
    </ClerkProvider>
  );
}
