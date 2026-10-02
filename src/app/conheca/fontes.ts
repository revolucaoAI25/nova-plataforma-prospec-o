import { Bricolage_Grotesque, Geist_Mono, Instrument_Serif } from "next/font/google";

// Fontes da página de vendas e das telas de contratação — só carregam nessas rotas.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const FONTES_LP = `${bricolage.variable} ${instrument.variable} ${geistMono.variable}`;
