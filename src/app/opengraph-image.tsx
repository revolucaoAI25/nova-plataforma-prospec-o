import { imagemOg, TAMANHO_OG } from "@/lib/og";

export const alt = "Leadmatic: reuniões qualificadas na sua agenda, toda semana";
export const size = TAMANHO_OG;
export const contentType = "image/png";

export default function Image() {
  return imagemOg({
    selo: "Prospecção B2B",
    titulo: "Reuniões qualificadas na sua agenda, toda semana. Sem prospecção manual.",
    rodape: "Empresas com o perfil certo · contato direto com o dono · WhatsApp, e-mail e LinkedIn",
  });
}
