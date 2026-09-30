import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/database.types";

export type ConexaoId = "whatsapp" | "email" | "linkedin" | "sheets" | "openai";

export interface ConexaoStatus {
  id: ConexaoId;
  label: string;
  descricao: string;
  /** Recurso liberado pra essa conta (plano/flag). Conexão indisponível não entra em checklist. */
  disponivel: boolean;
  conectado: boolean;
  detalhe: string;
  href: string;
}

/**
 * Estado real de cada integração do usuário, calculado a partir das
 * tabelas (nunca de uma marcação manual) — usado pela página Conexões e
 * pelo passo a passo do onboarding, pra "conectado" sempre refletir o que
 * de fato está funcionando.
 */
export async function statusConexoes(sb: SupabaseClient, profile: Profile): Promise<ConexaoStatus[]> {
  const admin = profile.role === "admin";
  const whatsappOk = admin || profile.disparo_habilitado;
  const emailOk = admin || profile.email_disparo_habilitado;
  const linkedinOk = admin || (profile.linkedin_disparo_habilitado && !profile.conta_teste);
  const iaOk = admin || profile.enriquecimento_ia_habilitado;

  const [instancias, dominios, remetentes, contasLinkedin] = await Promise.all([
    whatsappOk
      ? sb.from("whatsapp_instances").select("status").eq("user_id", profile.id)
      : Promise.resolve({ data: [] as { status: string }[] }),
    emailOk
      ? sb.from("email_domains").select("status").eq("user_id", profile.id)
      : Promise.resolve({ data: [] as { status: string }[] }),
    emailOk
      ? sb.from("email_senders").select("id").eq("user_id", profile.id)
      : Promise.resolve({ data: [] as { id: string }[] }),
    linkedinOk
      ? sb.from("linkedin_accounts").select("status").eq("user_id", profile.id)
      : Promise.resolve({ data: [] as { status: string }[] }),
  ]);

  const nInstancias = (instancias.data ?? []).filter((i) => i.status === "conectado").length;
  const nDominios = (dominios.data ?? []).filter((d) => d.status === "verified").length;
  const nRemetentes = (remetentes.data ?? []).length;
  const nLinkedin = (contasLinkedin.data ?? []).filter((c) => c.status === "conectado").length;
  const sheetsConectado = Boolean(profile.google_sheets_creds?.oauth);

  return [
    {
      id: "whatsapp",
      label: "WhatsApp",
      descricao: "Número que vai enviar as mensagens das campanhas.",
      disponivel: whatsappOk,
      conectado: nInstancias > 0,
      detalhe: nInstancias ? `${nInstancias} número(s) conectado(s)` : "Nenhum número conectado",
      href: "/disparo",
    },
    {
      id: "email",
      label: "E-mail",
      descricao: "Domínio verificado e remetente pras campanhas de e-mail.",
      disponivel: emailOk,
      conectado: nDominios > 0 && nRemetentes > 0,
      detalhe: nDominios
        ? `${nDominios} domínio(s) verificado(s) · ${nRemetentes} remetente(s)`
        : "Nenhum domínio verificado",
      href: "/disparo-email",
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      descricao: "Conta que envia convites e mensagens.",
      disponivel: linkedinOk,
      conectado: nLinkedin > 0,
      detalhe: nLinkedin ? `${nLinkedin} conta(s) conectada(s)` : "Nenhuma conta conectada",
      href: "/disparo-linkedin",
    },
    {
      id: "sheets",
      label: "Google Sheets",
      descricao: "Planilhas pra receber os leads e acompanhar os resultados.",
      disponivel: true,
      conectado: sheetsConectado,
      detalhe: sheetsConectado ? "Conta Google conectada" : "Não conectado",
      href: "/conexoes#sheets",
    },
    {
      id: "openai",
      label: "OpenAI",
      descricao: "Sua chave, usada só pelos enriquecimentos com IA.",
      disponivel: iaOk,
      conectado: Boolean(profile.openai_api_key),
      detalhe: profile.openai_api_key ? "Chave cadastrada" : "Sem chave",
      href: "/conexoes#openai",
    },
  ];
}
