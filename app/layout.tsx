import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import Script from "next/script";
import { BASE_PATH } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Omni Alt",
  description: "Sistema interno de gestão — Omni Alt",
  icons: {
    icon: [
      { url: `${BASE_PATH}/favicon-dark.png`, media: "(prefers-color-scheme: light)", sizes: "32x32", type: "image/png" },
      { url: `${BASE_PATH}/favicon-light.png`, media: "(prefers-color-scheme: dark)", sizes: "32x32", type: "image/png" },
      { url: `${BASE_PATH}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${BASE_PATH}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: `${BASE_PATH}/apple-touch-icon.png`,
  },
  openGraph: {
    title: "Omni Alt",
    description: "Sistema interno de gestão — Omni Alt",
    images: [`${BASE_PATH}/icon-512.png`],
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
