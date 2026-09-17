import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Prospecção Ativa",
    template: "%s · Prospecção Ativa",
  },
  description: "Plataforma de prospecção ativa multicanal — extração de leads por CNPJ, Google Maps e Instagram.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`} style={{ colorScheme: "dark" }}>
      <body className="min-h-full flex flex-col">
        {children}
        <div className="bg-noise" aria-hidden="true" />
      </body>
    </html>
  );
}
