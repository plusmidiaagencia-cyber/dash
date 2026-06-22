import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HARGROVE — Painel",
  description: "Métricas e lucro real da loja HARGROVE — Shopify + Facebook Ads.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
