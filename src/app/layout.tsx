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

// Aplica o tema salvo (localStorage) em <html> ANTES do 1º paint — sem
// isso, a página nasce no tema padrão (escuro) e "pisca" pro claro um
// instante depois, no primeiro useEffect do lado cliente (FOUC). Roda
// como script inline síncrono no <head>, não um componente React (que só
// executaria depois da hidratação, tarde demais pra evitar o flash).
const NO_FOUC_THEME_SCRIPT = `
try {
  var t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FOUC_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <div className="bg-noise" aria-hidden="true" />
      </body>
    </html>
  );
}
