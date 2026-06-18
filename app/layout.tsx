import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";

export const metadata: Metadata = {
  title: "Omini Alt",
  description: "Sistema interno de gestão — Omini Alt",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={ptBR}>
      <html lang="pt-BR" className="h-full">
        <body className="min-h-full flex flex-col bg-gray-50">{children}</body>
      </html>
    </ClerkProvider>
  );
}
