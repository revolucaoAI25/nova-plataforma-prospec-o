import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import { Inter } from "next/font/google";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Códigos de verificação do Google Search Console e do Bing Webmaster Tools
// (só o valor do content da meta tag), nas variáveis do Railway. Quem
// verifica o domínio inteiro pelo DNS não precisa deles.
const verificacaoOutros: Record<string, string> = {};
if (process.env.BING_SITE_VERIFICATION) verificacaoOutros["msvalidate.01"] = process.env.BING_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Leadmatic",
  title: {
    default: "Leadmatic",
    template: "%s · Leadmatic",
  },
  description: "Plataforma de prospecção ativa multicanal — extração de leads por CNPJ, Google Maps e Instagram.",
  openGraph: { siteName: "Leadmatic", locale: "pt_BR", type: "website" },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: Object.keys(verificacaoOutros).length ? verificacaoOutros : undefined,
  },
};

// O padrão é o modo claro (data-theme="light" já vem no HTML); o escuro só
// quando a pessoa escolhe no botão de tema (fica salvo no localStorage).
// O script aplica a escolha salva em <html> ANTES do 1º paint — sem isso a
// página nasceria clara e "piscaria" para o escuro (FOUC). Roda como script
// inline síncrono no <head>, não um componente React (que só executaria
// depois da hidratação, tarde demais pra evitar o flash).
const NO_FOUC_THEME_SCRIPT = `
try {
  var t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: o script anti-FOUC muda data-theme no <html>
    // antes da hidratação, de propósito — sem isso o React acusa divergência.
    <html lang="pt-BR" data-theme="light" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FOUC_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ConfirmProvider>{children}</ConfirmProvider>
        <div className="bg-noise" aria-hidden="true" />
      </body>
    </html>
  );
}
