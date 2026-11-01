import { imagemOg, TAMANHO_OG } from "@/lib/og";

export const alt = "Blog do Leadmatic: prospecção ativa e geração de clientes B2B";
export const size = TAMANHO_OG;
export const contentType = "image/png";

export default function Image() {
  return imagemOg({
    selo: "Blog",
    titulo: "Prospecção ativa e geração de clientes B2B, sem enrolação",
    rodape: "Guias, roteiros, comparativos e estratégias por segmento",
  });
}
